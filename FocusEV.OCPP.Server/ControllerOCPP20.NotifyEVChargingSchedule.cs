

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
        public string HandleNotifyEVChargingSchedule(OCPPMessage msgIn, OCPPMessage msgOut)
        {
            string errorCode = null;

            Logger.LogTrace("Processing NotifyEVChargingSchedule...");
            NotifyEVChargingScheduleResponse notifyEVChargingScheduleResponse = new NotifyEVChargingScheduleResponse();
            notifyEVChargingScheduleResponse.CustomData = new CustomDataType();
            notifyEVChargingScheduleResponse.CustomData.VendorId = VendorId;

            StringBuilder periods = new StringBuilder();
            int connectorId = 0;

            try
            {
                NotifyEVChargingScheduleRequest notifyEVChargingScheduleRequest = JsonConvert.DeserializeObject<NotifyEVChargingScheduleRequest>(msgIn.JsonPayload);
                Logger.LogTrace("NotifyEVChargingSchedule => Message deserialized");


                if (ChargePointStatus != null)
                {
                    // Known charge station
                    if (notifyEVChargingScheduleRequest.ChargingSchedule != null)
                    {
                        if (notifyEVChargingScheduleRequest.ChargingSchedule?.ChargingSchedulePeriod != null)
                        {
                            // Concat all periods and write them in messag log...

                            DateTimeOffset timeBase = notifyEVChargingScheduleRequest.TimeBase;
                            foreach (ChargingSchedulePeriodType period in notifyEVChargingScheduleRequest.ChargingSchedule?.ChargingSchedulePeriod)
                            {
                                if (periods.Length > 0)
                                {
                                    periods.Append(" | ");
                                }

                                DateTimeOffset time = timeBase.AddSeconds(period.StartPeriod);
                                periods.Append(string.Format("{0}: {1}{2}", time.ToString("O"), period.Limit, notifyEVChargingScheduleRequest.ChargingSchedule.ChargingRateUnit.ToString()));

                                if (period.NumberPhases > 0)
                                {
                                    periods.Append(string.Format(" ({0} Phases)", period.NumberPhases));
                                }
                            }
                        }
                    }
                    connectorId = notifyEVChargingScheduleRequest.EvseId;
                    Logger.LogInformation("NotifyEVChargingSchedule => {0}", periods.ToString());
                }
                else
                {
                    // Unknown charge station
                    errorCode = ErrorCodes.GenericError;
                }

                msgOut.JsonPayload = JsonConvert.SerializeObject(notifyEVChargingScheduleResponse);
                Logger.LogTrace("NotifyEVChargingSchedule => Response serialized");
            }
            catch (Exception exp)
            {
                Logger.LogError(exp, "NotifyEVChargingSchedule => Exception: {0}", exp.Message);
                errorCode = ErrorCodes.InternalError;
            }

            WriteMessageLog(ChargePointStatus.Id, connectorId, msgIn.Action, periods.ToString(), errorCode);
            return errorCode;
        }
    }
}
