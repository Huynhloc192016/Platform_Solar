
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using FocusEV.OCPP.Database;
using FocusEV.OCPP.Server.Messages_OCPP16;
using System.Net.Http;
using Microsoft.EntityFrameworkCore;
using System.Text;

namespace FocusEV.OCPP.Server
{
    public partial class ControllerOCPP16
    {
        HttpClient _httpClient = new HttpClient();

        public string  HandleMeterValues(OCPPMessage msgIn, OCPPMessage msgOut)
        {
            string errorCode = null;
            MeterValuesResponse meterValuesResponse = new MeterValuesResponse();

            int connectorId = -1;
            string msgMeterValue = string.Empty;

            try
            {
                Logger.LogTrace("Processing meter values...");
                MeterValuesRequest meterValueRequest = JsonConvert.DeserializeObject<MeterValuesRequest>(msgIn.JsonPayload);
                Logger.LogTrace("MeterValues => Message deserialized");
                Logger.LogTrace("Insitulog " + msgIn.JsonPayload);
                connectorId = meterValueRequest.ConnectorId;

                if (ChargePointStatus != null)
                {
                    // Known charge station => process meter values
                    double currentChargeKW = -1;
                    double meterKWH = -1;
                    double voltag = -1;
                    double temperatTure = -1;
                    double currentOffered = -1;
                    double currentImport = -1;
                    double power = -1;
                    double power2 = -1;
                    DateTimeOffset? meterTime = null;
                    double stateOfCharge = -1;
                    foreach (MeterValue meterValue in meterValueRequest.MeterValue)
                    {
                        foreach (SampledValue sampleValue in meterValue.SampledValue)
                        {
                            Logger.LogTrace("MeterValues => Context={0} / Format={1} / Value={2} / Unit={3} / Location={4} / Measurand={5} / Phase={6}",
                                sampleValue.Context, sampleValue.Format, sampleValue.Value, sampleValue.Unit, sampleValue.Location, sampleValue.Measurand, sampleValue.Phase);

                            if (sampleValue.Measurand == SampledValueMeasurand.Power_Active_Import)
                            {
                                // current charging power
                                if (double.TryParse(sampleValue.Value, NumberStyles.Float, CultureInfo.InvariantCulture, out currentChargeKW))
                                {
                                    if (sampleValue.Unit == SampledValueUnit.W ||
                                        sampleValue.Unit == SampledValueUnit.VA ||
                                        sampleValue.Unit == SampledValueUnit.Var ||
                                        sampleValue.Unit == null)
                                    {
                                        Logger.LogTrace("MeterValues => Charging '{0:0.0}' W", currentChargeKW);
                                        // convert W => kW
                                        currentChargeKW = currentChargeKW / 1000;
                                    }
                                    else if (sampleValue.Unit == SampledValueUnit.KW ||
                                            sampleValue.Unit == SampledValueUnit.KVA ||
                                            sampleValue.Unit == SampledValueUnit.Kvar)
                                    {
                                        // already kW => OK
                                        Logger.LogTrace("MeterValues => Charging '{0:0.0}' kW", currentChargeKW);
                                    }
                                    else
                                    {
                                        Logger.LogWarning("MeterValues => Charging: unexpected unit: '{0}' (Value={1})", sampleValue.Unit, sampleValue.Value);
                                    }
                                }
                                else
                                {
                                    Logger.LogError("MeterValues => Charging: invalid value '{0}' (Unit={1})", sampleValue.Value, sampleValue.Unit);
                                }
                            }
                            else if (sampleValue.Measurand == SampledValueMeasurand.Energy_Active_Import_Register ||
                                    sampleValue.Measurand == null)
                            {
                                // charged amount of energy
                                if (double.TryParse(sampleValue.Value, NumberStyles.Float, CultureInfo.InvariantCulture, out meterKWH))
                                {
                                    if (sampleValue.Unit == SampledValueUnit.Wh ||
                                        sampleValue.Unit == SampledValueUnit.Varh ||
                                        sampleValue.Unit == null)
                                    {
                                        Logger.LogTrace("MeterValues => Value: '{0:0.0}' Wh", meterKWH);
                                        // convert Wh => kWh
                                        meterKWH = meterKWH / 1000;
                                    }
                                    else if (sampleValue.Unit == SampledValueUnit.KWh ||
                                            sampleValue.Unit == SampledValueUnit.Kvarh)
                                    {
                                        // already kWh => OK
                                        Logger.LogTrace("MeterValues => Value: '{0:0.0}' kWh", meterKWH);
                                    }
                                    else
                                    {
                                        Logger.LogWarning("MeterValues => Value: unexpected unit: '{0}' (Value={1})", sampleValue.Unit, sampleValue.Value);
                                    }
                                    meterTime = meterValue.Timestamp;
                                }
                                else
                                {
                                    Logger.LogError("MeterValues => Value: invalid value '{0}' (Unit={1})", sampleValue.Value, sampleValue.Unit);
                                }
                            }
                            else if (sampleValue.Measurand == SampledValueMeasurand.SoC)
                            {
                                // state of charge (battery status)
                                if (double.TryParse(sampleValue.Value, NumberStyles.Float, CultureInfo.InvariantCulture, out stateOfCharge))
                                {
                                    Logger.LogTrace("MeterValues => SoC: '{0:0.0}'%", stateOfCharge);
                                }
                                else
                                {
                                    Logger.LogError("MeterValues => invalid value '{0}' (SoC)", sampleValue.Value);
                                }
                            }
                            else if (sampleValue.Measurand == SampledValueMeasurand.Voltag_Requested)
                            {
                                // charged amount of energy
                                if (double.TryParse(sampleValue.Value, NumberStyles.Float, CultureInfo.InvariantCulture, out voltag))
                                {

                                }
                            }
                            else if (sampleValue.Measurand == SampledValueMeasurand.Temperature)
                            {
                                // charged amount of energy
                                if (double.TryParse(sampleValue.Value, NumberStyles.Float, CultureInfo.InvariantCulture, out temperatTure))
                                {

                                }
                            }
                            else if (sampleValue.Measurand == SampledValueMeasurand.Current_Offered)
                            {
                                // charged amount of energy
                                if (double.TryParse(sampleValue.Value, NumberStyles.Float, CultureInfo.InvariantCulture, out currentOffered))
                                {

                                }
                            }
                            else if (sampleValue.Measurand == SampledValueMeasurand.Current_Import)
                            {
                                // charged amount of energy
                                if (double.TryParse(sampleValue.Value, NumberStyles.Float, CultureInfo.InvariantCulture, out currentImport))
                                {

                                }
                            }
                            else if (sampleValue.Measurand == SampledValueMeasurand.Power_Active_Export)
                            {
                                // charged amount of energy
                                if (double.TryParse(sampleValue.Value, NumberStyles.Float, CultureInfo.InvariantCulture, out power))
                                {

                                }
                            }
                            else if (sampleValue.Measurand == SampledValueMeasurand.Power_Offered)
                            {
                                // charged amount of energy
                                if (double.TryParse(sampleValue.Value, NumberStyles.Float, CultureInfo.InvariantCulture, out power2))
                                {

                                }
                            }
                        }
                    }

                    // write charging/meter data in chargepoint status
                    if (connectorId > 0)
                    {
                        double current = 0;
                        if (currentOffered != 0)
                            current = currentOffered;
                        if (currentImport != 0)
                            current = currentImport;
                        msgMeterValue = $"Meter (kWh): {meterKWH} | Charge (kW): {currentChargeKW} | SoC (%): {stateOfCharge} | Voltage (V): {voltag} | Temperature (C): {temperatTure} | Current (A): {current} " ;
                        //
                        
                        //
                        if (meterKWH >= 0)
                        {
                            WriteMessageLog(ChargePointStatus.Id, connectorId, msgIn.Action, msgMeterValue, errorCode);
                           
                            decimal getAmount = 0;
                            decimal currentPrice = 0;
                            double lastMeter = 0;
                            try
                            {
                                using (OCPPCoreContext dbContext = new OCPPCoreContext(Configuration))
                                {
                                    ConnectorStatus ConnectorStatus = dbContext.ConnectorStatuses.Where(m => m.ChargePointId == ChargePointStatus.Id && m.ConnectorId == connectorId).FirstOrDefault();
                                    if (ConnectorStatus != null)
                                    {
                                        ConnectorStatus.LastMeterRemote = meterKWH + "|" + currentChargeKW + "|" + stateOfCharge + "|" + voltag + "|" + temperatTure + "|" + current;
                                        ConnectorStatus.RemoteTime = DateTime.Now;
                                        dbContext.SaveChanges();
                                    }

                                    // Lớp bảo vệ upperLimit: dừng sớm trước khi hết tiền (buffer VND) để tránh bị âm
                                    const decimal BalanceBufferVnd = 15000m; // Dừng sớm 15.000 VND để trạm kịp dừng, tránh âm tiền
                                    var gettran = dbContext.Transactions
                                        .Where(m => m.ChargePointId == ChargePointStatus.Id && m.ConnectorId == connectorId && !m.MeterStop.HasValue)
                                        .OrderByDescending(m => m.TransactionId)
                                        .FirstOrDefault();
                                    if (gettran != null)
                                    {
                                        var wl = dbContext.WalletTransactions.Where(m => m.TransactionId == gettran.TransactionId).FirstOrDefault();
                                        if (wl != null && wl.chargeType == "valueControl" && wl.currentBalance.HasValue && wl.ExchangeRate.HasValue && wl.ExchangeRate.Value > 0)
                                        {
                                            decimal currentBalance = wl.currentBalance.Value;
                                            decimal exchangeRate = wl.ExchangeRate.Value;
                                            double meterStart = (double)gettran.MeterStart;
                                            decimal totalMeterKwh = (decimal)(meterKWH - meterStart);
                                            decimal estimatedAmount = totalMeterKwh * exchangeRate;
                                            decimal stopThreshold = currentBalance - BalanceBufferVnd; // Dừng khi ước tính còn buffer, tránh âm
                                            if (estimatedAmount >= stopThreshold && wl.newBalance == null)
                                            {
                                                Logger.LogInformation("MeterValues => Lớp bảo vệ upperLimit: estimatedAmount={0} >= (currentBalance - buffer)={1}. Gọi RemoteStop. TransactionId={2}", estimatedAmount, stopThreshold, gettran.TransactionId);
                                                _ = RemoteStopTransaction(ChargePointStatus.Id, gettran.TransactionId);
                                                _ = SendMessageStop(wl.UserAppId);
                                            }
                                        }
                                    }
                                }

                            }
                            catch (Exception ex)
                            {
                                msgOut.JsonPayload = JsonConvert.SerializeObject(meterValuesResponse);
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

         
           
            return errorCode;
        }
        public async Task ReCallApi(string ChargePointId)
        {
            await Task.Delay(1000); // Đợi 1 giây 
            string apiUrl = "http://solarev-lado-server.insitu.com.vn/TriggerMessage?id=" + ChargePointId+"&message=MeterValues";
            HttpResponseMessage response = await _httpClient.GetAsync(apiUrl);
            string responseContent = await response.Content.ReadAsStringAsync();
        }

        public async Task RemoteStopTransaction(string ChargePointId, int TransactionId)
        {
            //string apiUrl = "http://solarev-lado-server.insitu.com.vn/RemoteStopTransaction?id=" + ChargePointId + "&TransactionId=" + TransactionId;
            string apiUrl = "http://103.77.167.17:8481/RemoteStopTransaction?id=" + ChargePointId + "&TransactionId=" + TransactionId;
            HttpResponseMessage response = await _httpClient.GetAsync(apiUrl);
            string responseContent = await response.Content.ReadAsStringAsync();
        }
        public async Task SendMessageStop(string userTo)
        {
            string serverKey = "AAAAvXGNK6E:APA91bG7sMWvF2POHTv4RbGIbkH9fA0v_lDvS2GTTvMD5lJamx7mLR_Df6rPusr9JHD4J3ZSxiKQyfCIG9uqcXX2lDPbO0c7CK_zUnrfu_UTg69jHe_ruaVeQIL448HDTF1dLIo0JRFw";
            string fcmUrl = "https://fcm.googleapis.com/fcm/send";

            var jsonMessage = @"{
           ""to"": """ + userTo + @""",
            ""notification"": {
                ""title"": ""Thông báo dừng sạc"",
                ""body"": ""Đơn sạc đã tự dừng vì số tiền trong ví đã hết. Vui lòng nạp thêm và tiến hành sạc lại""
            },
            ""data"": {
                ""promo_type"": ""CHARGE_FINISH"",
                ""title"": ""fdsf"",
                ""body"": ""fdsfs"",
                ""click_action"": ""FLUTTER_NOTIFICATION_CLICK""
            }
        }";

            using (var httpClient = new HttpClient())
            {
                httpClient.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", $"key={serverKey}");
                httpClient.DefaultRequestHeaders.TryAddWithoutValidation("Content-Type", "application/json");

                var content = new StringContent(jsonMessage, Encoding.UTF8, "application/json");
                var response = await httpClient.PostAsync(fcmUrl, content);

                var responseContent = await response.Content.ReadAsStringAsync();

                Console.WriteLine($"FCM response: {responseContent}");
            }
        }
    }
}
