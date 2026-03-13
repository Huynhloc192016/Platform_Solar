
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using FocusEV.OCPP.Database;
using FocusEV.OCPP.Server.Messages_OCPP16;

namespace FocusEV.OCPP.Server
{
    public partial class ControllerOCPP16
    {
        public string HandleBootNotification(OCPPMessage msgIn, OCPPMessage msgOut)
        {
            string errorCode = null;

            try
            {
                Logger.LogTrace("Processing boot notification...");
                BootNotificationRequest bootNotificationRequest = JsonConvert.DeserializeObject<BootNotificationRequest>(msgIn.JsonPayload);
                Logger.LogTrace("BootNotification => Message deserialized");

                BootNotificationResponse bootNotificationResponse = new BootNotificationResponse();
                bootNotificationResponse.CurrentTime = DateTimeOffset.UtcNow;
                bootNotificationResponse.Interval = 300;    // 300 seconds

                if (ChargePointStatus != null)
                {
                    // Known charge station => accept
                    bootNotificationResponse.Status = BootNotificationResponseStatus.Accepted;
                }
                else
                {
                    // Unknown charge station => reject
                    bootNotificationResponse.Status = BootNotificationResponseStatus.Rejected;
                }

                msgOut.JsonPayload = JsonConvert.SerializeObject(bootNotificationResponse);
                Logger.LogTrace("BootNotification => Response serialized");
            }
            catch (Exception exp)
            {
                Logger.LogError(exp, "BootNotification => Exception: {0}", exp.Message);
                errorCode = ErrorCodes.FormationViolation;
            }

            WriteMessageLog(ChargePointStatus.Id, null, msgIn.Action, null, errorCode);
            return errorCode;
        }
    }
}
