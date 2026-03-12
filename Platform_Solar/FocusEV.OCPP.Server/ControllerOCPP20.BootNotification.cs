

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using FocusEV.OCPP.Database;
using FocusEV.OCPP.Server.Messages_OCPP20;

namespace FocusEV.OCPP.Server
{
    public partial class ControllerOCPP20
    {
        public string HandleBootNotification(OCPPMessage msgIn, OCPPMessage msgOut)
        {
            string errorCode = null;
            string bootReason = null;
            try
            {
                Logger.LogTrace("Processing boot notification...");
                BootNotificationRequest bootNotificationRequest = JsonConvert.DeserializeObject<BootNotificationRequest>(msgIn.JsonPayload);
                Logger.LogTrace("BootNotification => Message deserialized");

                bootReason = bootNotificationRequest?.Reason.ToString();
                Logger.LogInformation("BootNotification => Reason={0}", bootReason);

                BootNotificationResponse bootNotificationResponse = new BootNotificationResponse();
                bootNotificationResponse.CurrentTime = DateTimeOffset.UtcNow;
                bootNotificationResponse.Interval = 300;    // 300 seconds

                bootNotificationResponse.StatusInfo = new StatusInfoType();
                bootNotificationResponse.StatusInfo.ReasonCode = string.Empty;
                bootNotificationResponse.StatusInfo.AdditionalInfo = string.Empty;

                bootNotificationResponse.CustomData = new CustomDataType();
                bootNotificationResponse.CustomData.VendorId = VendorId;

                if (ChargePointStatus != null)
                {
                    // Known charge station => accept
                    bootNotificationResponse.Status = RegistrationStatusEnumType.Accepted;
                }
                else
                {
                    // Unknown charge station => reject
                    bootNotificationResponse.Status = RegistrationStatusEnumType.Rejected;
                }

                msgOut.JsonPayload = JsonConvert.SerializeObject(bootNotificationResponse);
                Logger.LogTrace("BootNotification => Response serialized");
            }
            catch (Exception exp)
            {
                Logger.LogError(exp, "BootNotification => Exception: {0}", exp.Message);
                errorCode = ErrorCodes.FormationViolation;
            }

            WriteMessageLog(ChargePointStatus.Id, null, msgIn.Action, bootReason, errorCode);
            return errorCode;
        }
    }
}
