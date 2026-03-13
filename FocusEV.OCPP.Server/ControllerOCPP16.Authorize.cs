
using System;
using System.Collections.Generic;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using FocusEV.OCPP.Database;
using FocusEV.OCPP.Server.Messages_OCPP16;

namespace FocusEV.OCPP.Server
{
    public partial class ControllerOCPP16
    {
        public string HandleAuthorize(OCPPMessage msgIn, OCPPMessage msgOut)
        {
            string errorCode = null;
            AuthorizeResponse authorizeResponse = new AuthorizeResponse();

            string idTag = null;
            try
            {
                Logger.LogTrace("Processing authorize request...");
                AuthorizeRequest authorizeRequest = JsonConvert.DeserializeObject<AuthorizeRequest>(msgIn.JsonPayload);
                Logger.LogTrace("Authorize => Message deserialized");
                idTag = CleanChargeTagId(authorizeRequest.IdTag, Logger);

                authorizeResponse.IdTagInfo.ParentIdTag = string.Empty;
                authorizeResponse.IdTagInfo.ExpiryDate = DateTimeOffset.UtcNow.AddMinutes(5);   // default: 5 minutes
                try
                {
                    using (OCPPCoreContext dbContext = new OCPPCoreContext(Configuration))
                    {
                        ChargeTag ct = dbContext.Find<ChargeTag>(idTag);
                        if (ct != null)
                        {
                            if (ct.ExpiryDate.HasValue)
                            {
                                authorizeResponse.IdTagInfo.ExpiryDate = ct.ExpiryDate.Value;
                            }
                            authorizeResponse.IdTagInfo.ParentIdTag = ct.ParentTagId;
                            if (ct.Blocked.HasValue && ct.Blocked.Value)
                            {
                                authorizeResponse.IdTagInfo.Status = IdTagInfoStatus.Blocked;
                            }
                            else if (ct.ExpiryDate.HasValue && ct.ExpiryDate.Value < DateTime.Now)
                            {
                                authorizeResponse.IdTagInfo.Status = IdTagInfoStatus.Expired;
                            }
                            else
                            {
                                authorizeResponse.IdTagInfo.Status = IdTagInfoStatus.Accepted;
                            }
                        }
                        else
                        {
                            // Không tìm thấy ChargeTag, kiểm tra xem có phải UserAppId không
                            var checkUserApp = dbContext.UserApps.Find(idTag);
                            if (checkUserApp != null)
                            {
                                // ===== QUAN TRỌNG: Bắt buộc balance >= 50.000 mới cho sạc (thống nhất với API RequireCharging) =====
                                const decimal MinBalanceToStartCharge = 50000m;
                                if (checkUserApp.Balance < MinBalanceToStartCharge)
                                {
                                    Logger.LogWarning("Authorize => UserApp '{0}' có balance={1} < {2}. Từ chối.", idTag, checkUserApp.Balance, MinBalanceToStartCharge);
                                    authorizeResponse.IdTagInfo.Status = IdTagInfoStatus.Blocked;
                                }
                                else
                                {
                                    authorizeResponse.IdTagInfo.Status = IdTagInfoStatus.Accepted;
                                }
                            }
                            else
                            {
                            authorizeResponse.IdTagInfo.Status = IdTagInfoStatus.Invalid;
                            }
                        }

                        Logger.LogInformation("Authorize => Status: {0}", authorizeResponse.IdTagInfo.Status);
                    }
                }
                catch (Exception exp)
                {
                    Logger.LogError(exp, "Authorize => Exception reading charge tag ({0}): {1}", idTag, exp.Message);
                    authorizeResponse.IdTagInfo.Status = IdTagInfoStatus.Invalid;
                }

                msgOut.JsonPayload = JsonConvert.SerializeObject(authorizeResponse);
                Logger.LogTrace("Authorize => Response serialized");
            }
            catch (Exception exp)
            {
                Logger.LogError(exp, "Authorize => Exception: {0}", exp.Message);
                errorCode = ErrorCodes.FormationViolation;
            }

            WriteMessageLog(ChargePointStatus?.Id, null,msgIn.Action, $"'{idTag}'=>{authorizeResponse.IdTagInfo?.Status}", errorCode);
            return errorCode;
        }
    }
}
