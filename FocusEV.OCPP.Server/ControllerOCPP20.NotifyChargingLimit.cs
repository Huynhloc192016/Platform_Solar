

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using FocusEV.OCPP.Database;
using FocusEV.OCPP.Server.Messages_OCPP20;

namespace FocusEV.OCPP.Server
{
    public partial class ControllerOCPP20
    {
        public string HandleNotifyChargingLimit(OCPPMessage msgIn, OCPPMessage msgOut)
        {
            string errorCode = null;

            Logger.LogTrace("Processing NotifyChargingLimit...");
            NotifyChargingLimitResponse notifyChargingLimitResponse = new NotifyChargingLimitResponse();
            notifyChargingLimitResponse.CustomData = new CustomDataType();
            notifyChargingLimitResponse.CustomData.VendorId = VendorId;

            string source = null;
            StringBuilder periods = new StringBuilder();
            int connectorId = 0;

            try
            {
                NotifyChargingLimitRequest notifyChargingLimitRequest = JsonConvert.DeserializeObject<NotifyChargingLimitRequest>(msgIn.JsonPayload);
                Logger.LogTrace("NotifyChargingLimit => Message deserialized");


                if (ChargePointStatus != null)
                {
                    // Known charge station
                    source = notifyChargingLimitRequest.ChargingLimit?.ChargingLimitSource.ToString();
                    if (notifyChargingLimitRequest.ChargingSchedule != null)
                    {
                        foreach (ChargingScheduleType schedule in notifyChargingLimitRequest.ChargingSchedule)
                        {
                            if (schedule.ChargingSchedulePeriod != null)
                            {
                                foreach (ChargingSchedulePeriodType period in schedule.ChargingSchedulePeriod)
                                {
                                    if (periods.Length > 0)
                                    {
                                        periods.Append(" | ");
                                    }

                                    periods.Append(string.Format("{0}s: {1}{2}", period.StartPeriod, period.Limit, schedule.ChargingRateUnit));

                                    if (period.NumberPhases > 0)
                                    {
                                        periods.Append(string.Format(" ({0} Phases)", period.NumberPhases));
                                    }
                                }
                            }
                        }
                    }
                    connectorId = notifyChargingLimitRequest.EvseId;
                    Logger.LogInformation("NotifyChargingLimit => {0}", periods);
                }
                else
                {
                    // Unknown charge station
                    errorCode = ErrorCodes.GenericError;
                }

                msgOut.JsonPayload = JsonConvert.SerializeObject(notifyChargingLimitResponse);
                Logger.LogTrace("NotifyChargingLimit => Response serialized");
            }
            catch (Exception exp)
            {
                Logger.LogError(exp, "NotifyChargingLimit => Exception: {0}", exp.Message);
                errorCode = ErrorCodes.InternalError;
            }

            WriteMessageLog(ChargePointStatus.Id, connectorId, msgIn.Action, source, errorCode);
            return errorCode;
        }
    }
}
