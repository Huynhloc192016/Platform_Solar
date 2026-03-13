

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
        public string HandleMeterValues(OCPPMessage msgIn, OCPPMessage msgOut)
        {
            string errorCode = null;
            MeterValuesResponse meterValuesResponse = new MeterValuesResponse();

            meterValuesResponse.CustomData = new CustomDataType();
            meterValuesResponse.CustomData.VendorId = VendorId;

            int connectorId = -1;
            string msgMeterValue = string.Empty;

            try
            {
                Logger.LogTrace("Processing meter values...");
                MeterValuesRequest meterValueRequest = JsonConvert.DeserializeObject<MeterValuesRequest>(msgIn.JsonPayload);
                Logger.LogTrace("MeterValues => Message deserialized");

                connectorId = meterValueRequest.EvseId;

                if (ChargePointStatus != null)
                {
                    // Known charge station => extract meter values with correct scale
                    double currentChargeKW = -1;
                    double meterKWH = -1;
                    DateTimeOffset? meterTime = null;
                    double stateOfCharge = -1;
                    GetMeterValues(meterValueRequest.MeterValue, out meterKWH, out currentChargeKW, out stateOfCharge, out meterTime);

                    // write charging/meter data in chargepoint status
                    if (connectorId > 0)
                    {
                        msgMeterValue = $"Meter (kWh): {meterKWH} | Charge (kW): {currentChargeKW} | SoC (%): {stateOfCharge}";

                        if (meterKWH >= 0)
                        {
                            UpdateConnectorStatus(connectorId, null, null, meterKWH, meterTime);
                        }

                        if (currentChargeKW >= 0 || meterKWH >= 0 || stateOfCharge >= 0)
                        {
                            if (ChargePointStatus.OnlineConnectors.ContainsKey(connectorId))
                            {
                                OnlineConnectorStatus ocs = ChargePointStatus.OnlineConnectors[connectorId];
                                if (currentChargeKW >= 0) ocs.ChargeRateKW = currentChargeKW;
                                if (meterKWH >= 0) ocs.MeterKWH = meterKWH;
                                if (stateOfCharge >= 0) ocs.SoC = stateOfCharge;
                            }
                            else
                            {
                                OnlineConnectorStatus ocs = new OnlineConnectorStatus();
                                if (currentChargeKW >= 0) ocs.ChargeRateKW = currentChargeKW;
                                if (meterKWH >= 0) ocs.MeterKWH = meterKWH;
                                if (stateOfCharge >= 0) ocs.SoC = stateOfCharge;
                                if (ChargePointStatus.OnlineConnectors.TryAdd(connectorId, ocs))
                                {
                                    Logger.LogTrace("MeterValues => Set OnlineConnectorStatus for ChargePoint={0} / Connector={1} / Values: {2}", ChargePointStatus?.Id, connectorId, msgMeterValue);
                                }
                                else
                                {
                                    Logger.LogError("MeterValues => Error adding new OnlineConnectorStatus for ChargePoint={0} / Connector={1} / Values: {2}", ChargePointStatus?.Id, connectorId, msgMeterValue);
                                }
                            }
                        }
                    }
                }
                else
                {
                    // Unknown charge station
                    errorCode = ErrorCodes.GenericError;
                }

                msgOut.JsonPayload = JsonConvert.SerializeObject(meterValuesResponse);
                Logger.LogTrace("MeterValues => Response serialized");
            }
            catch (Exception exp)
            {
                Logger.LogError(exp, "MeterValues => Exception: {0}", exp.Message);
                errorCode = ErrorCodes.InternalError;
            }

            WriteMessageLog(ChargePointStatus.Id, connectorId, msgIn.Action, msgMeterValue, errorCode);
            return errorCode;
        }
    }
}
