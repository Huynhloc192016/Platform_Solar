
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
        public string HandleStatusNotification(OCPPMessage msgIn, OCPPMessage msgOut)
        {
            string errorCode = null;
            StatusNotificationResponse statusNotificationResponse = new StatusNotificationResponse();

            int connectorId = 0;
            bool msgWritten = false;

            try
            {
                Logger.LogTrace("Processing status notification...");
                StatusNotificationRequest statusNotificationRequest = JsonConvert.DeserializeObject<StatusNotificationRequest>(msgIn.JsonPayload);
                Logger.LogTrace("StatusNotification => Message deserialized");

                connectorId = statusNotificationRequest.ConnectorId;

                // Write raw status in DB
                msgWritten = WriteMessageLog(ChargePointStatus.Id, connectorId, msgIn.Action, string.Format("Info={0} / Status={1} / ", statusNotificationRequest.Info, statusNotificationRequest.Status), statusNotificationRequest.ErrorCode.ToString());

                ConnectorStatusEnum newStatus = ConnectorStatusEnum.Undefined;

                switch (statusNotificationRequest.Status)
                {
                    case StatusNotificationRequestStatus.Available:
                        newStatus = ConnectorStatusEnum.Available;
                        break;
                    case StatusNotificationRequestStatus.Preparing:
                    case StatusNotificationRequestStatus.Charging:
                    case StatusNotificationRequestStatus.SuspendedEVSE:
                    case StatusNotificationRequestStatus.SuspendedEV:
                    case StatusNotificationRequestStatus.Finishing:
                    case StatusNotificationRequestStatus.Reserved:
                        newStatus = ConnectorStatusEnum.Occupied;
                        break;
                    case StatusNotificationRequestStatus.Unavailable:
                        newStatus = ConnectorStatusEnum.Unavailable;
                        break;
                    case StatusNotificationRequestStatus.Faulted:
                        newStatus = ConnectorStatusEnum.Faulted;
                        break;

                }
                Logger.LogInformation("StatusNotification => ChargePoint={0} / Connector={1} / newStatus={2}", ChargePointStatus?.Id, connectorId, newStatus.ToString());

                if (connectorId > 0)
                {
                    if (UpdateConnectorStatus(connectorId, newStatus.ToString(), statusNotificationRequest.Timestamp, null, null) == false)
                    {
                        errorCode = ErrorCodes.InternalError;
                    }

                    if (ChargePointStatus.OnlineConnectors.ContainsKey(connectorId))
                    {
                        OnlineConnectorStatus ocs = ChargePointStatus.OnlineConnectors[connectorId];
                        ocs.Status = newStatus;
                    }
                    else
                    {
                        OnlineConnectorStatus ocs = new OnlineConnectorStatus();
                        ocs.Status = newStatus;
                        if (ChargePointStatus.OnlineConnectors.TryAdd(connectorId, ocs))
                        {
                            Logger.LogTrace("StatusNotification => new OnlineConnectorStatus with values: ChargePoint={0} / Connector={1} / newStatus={2}", ChargePointStatus?.Id, connectorId, newStatus.ToString());
                        }
                        else
                        {
                            Logger.LogError("StatusNotification => Error adding new OnlineConnectorStatus for ChargePoint={0} / Connector={1}", ChargePointStatus?.Id, connectorId);
                        }
                    }
                }
                else
                {
                    Logger.LogWarning("StatusNotification => Status for unexpected ConnectorId={1} on ChargePoint={0}", ChargePointStatus?.Id, connectorId);
                }

                msgOut.JsonPayload = JsonConvert.SerializeObject(statusNotificationResponse);
                Logger.LogTrace("StatusNotification => Response serialized");
            }
            catch (Exception exp)
            {
                Logger.LogError(exp, "StatusNotification => ChargePoint={0} / Exception: {1}", ChargePointStatus.Id, exp.Message);
                errorCode = ErrorCodes.InternalError;
            }

            if (!msgWritten)
            {
                WriteMessageLog(ChargePointStatus.Id, connectorId, msgIn.Action, null, errorCode);
            }
            return errorCode;
        }
    }
}
