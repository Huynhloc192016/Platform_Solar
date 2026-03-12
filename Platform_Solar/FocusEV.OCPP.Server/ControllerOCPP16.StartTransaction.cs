
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using FocusEV.OCPP.Database;
using FocusEV.OCPP.Server.Messages_OCPP16;
using System.Net.Http;
using System.Text;

namespace FocusEV.OCPP.Server
{
    public partial class ControllerOCPP16
    {
        public string HandleStartTransaction(OCPPMessage msgIn, OCPPMessage msgOut)
        {
            string errorCode = null;
            StartTransactionResponse startTransactionResponse = new StartTransactionResponse();
            string tagid = "";
            int connectorId = -1;

            try
            {
                Logger.LogTrace("Processing startTransaction request...");
                StartTransactionRequest startTransactionRequest = JsonConvert.DeserializeObject<StartTransactionRequest>(msgIn.JsonPayload);
                Logger.LogTrace("StartTransaction => Message deserialized");

                string idTag = CleanChargeTagId(startTransactionRequest.IdTag, Logger);
                connectorId = startTransactionRequest.ConnectorId;

                startTransactionResponse.IdTagInfo.ParentIdTag = string.Empty;
                startTransactionResponse.IdTagInfo.ExpiryDate = MaxExpiryDate;

                if (string.IsNullOrWhiteSpace(idTag))
                {
                    // ===== QUAN TRỌNG: Khi không có idTag thì từ chối, yêu cầu quét lại mã =====
                    Logger.LogWarning("StartTransaction => idTag null hoặc empty. Từ chối để yêu cầu quét lại mã.");
                    startTransactionResponse.IdTagInfo.Status = IdTagInfoStatus.Invalid;
                }
                else
                {
                    try
                    {
                        using (OCPPCoreContext dbContext = new OCPPCoreContext(Configuration))
                        {
                            ChargeTag ct = dbContext.Find<ChargeTag>(idTag);
                            if (ct != null)
                            {
                               
                                if (ct.ExpiryDate.HasValue) startTransactionResponse.IdTagInfo.ExpiryDate = ct.ExpiryDate.Value;
                                startTransactionResponse.IdTagInfo.ParentIdTag = ct.ParentTagId;
                                if (ct.Blocked.HasValue && ct.Blocked.Value)
                                {
                                    startTransactionResponse.IdTagInfo.Status = IdTagInfoStatus.Blocked;
                                }
                                else if (ct.ExpiryDate.HasValue && ct.ExpiryDate.Value < DateTime.Now)
                                {
                                    startTransactionResponse.IdTagInfo.Status = IdTagInfoStatus.Expired;
                                }
                                else
                                {
                                    startTransactionResponse.IdTagInfo.Status = IdTagInfoStatus.Accepted;
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
                                        Logger.LogWarning("StartTransaction => UserApp '{0}' có balance={1} < {2}. Từ chối sạc.", idTag, checkUserApp.Balance, MinBalanceToStartCharge);
                                        startTransactionResponse.IdTagInfo.Status = IdTagInfoStatus.Blocked;
                                    }
                                    else
                                    {
                                        startTransactionResponse.IdTagInfo.Status = IdTagInfoStatus.Accepted;
                                    }
                                }
                                else
                                {
                                startTransactionResponse.IdTagInfo.Status = IdTagInfoStatus.Invalid;
                                }
                            }

                            Logger.LogInformation("StartTransaction => Charge tag='{0}' => Status: {1}", idTag, startTransactionResponse.IdTagInfo.Status);
                        }
                    }
                    catch (Exception exp)
                    {
                        Logger.LogError(exp, "StartTransaction => Exception reading charge tag ({0}): {1}", idTag, exp.Message);
                        startTransactionResponse.IdTagInfo.Status = IdTagInfoStatus.Invalid;
                    }
                }

                if (connectorId > 0)
                {
                    // Update meter value in db connector status 
                    UpdateConnectorStatus(connectorId, ConnectorStatusEnum.Occupied.ToString(), startTransactionRequest.Timestamp, (double)startTransactionRequest.MeterStart / 1000, startTransactionRequest.Timestamp);
                }

                if (startTransactionResponse.IdTagInfo.Status == IdTagInfoStatus.Accepted)
                {
                    try
                    {
                        using (OCPPCoreContext dbContext = new OCPPCoreContext(Configuration))
                        {
                            // ===== QUAN TRỌNG: Đóng các transaction cũ của cùng ConnectorId trước khi tạo transaction mới =====
                            if (connectorId > 0 && ChargePointStatus != null && !string.IsNullOrEmpty(ChargePointStatus.Id))
                            {
                                // Kiểm tra xem có transaction đang mở của cùng ConnectorId không
                                string chargePointId = ChargePointStatus.Id; // Lưu vào biến để dùng trong LINQ
                                var oldTransactions = dbContext.Transactions
                                    .Where(t => t.ChargePointId == chargePointId 
                                             && t.ConnectorId == connectorId 
                                             && !t.StopTime.HasValue)
                                    .ToList();
                                
                                if (oldTransactions.Any())
                                {
                                    Logger.LogWarning("StartTransaction => Phát hiện {0} transaction đang mở cho ConnectorId={1}, ChargePointId={2}. Đang đóng các transaction này trước khi tạo transaction mới...", 
                                        oldTransactions.Count, connectorId, ChargePointStatus?.Id);
                                    
                                    foreach (var oldTrans in oldTransactions)
                                    {
                                        // Đóng transaction cũ với lý do "DeAuthorized"
                                        oldTrans.StopTime = startTransactionRequest.Timestamp.UtcDateTime;
                                        oldTrans.StopReason = "DeAuthorized";
                                        oldTrans.StopTagId = oldTrans.StartTagId; // Giữ nguyên StartTagId
                                        
                                        // Nếu có MeterStart, có thể ước tính MeterStop từ ConnectorStatus
                                        if (oldTrans.MeterStart.HasValue)
                                        {
                                            var connectorStatus = dbContext.ConnectorStatuses
                                                .FirstOrDefault(cs => cs.ChargePointId == oldTrans.ChargePointId 
                                                                    && cs.ConnectorId == oldTrans.ConnectorId);
                                            if (connectorStatus != null && connectorStatus.LastMeter.HasValue)
                                            {
                                                oldTrans.MeterStop = connectorStatus.LastMeter.Value;
                                            }
                                            else
                                            {
                                                // Nếu không có LastMeter, dùng MeterStart từ request mới
                                                oldTrans.MeterStop = (double)startTransactionRequest.MeterStart / 1000;
                                            }
                                        }
                                        
                                        Logger.LogInformation("StartTransaction => Đã đóng transaction cũ: TransactionId={0}, StartTagId={1}, StartTime={2}, StopTime={3}", 
                                            oldTrans.TransactionId, oldTrans.StartTagId, oldTrans.StartTime, oldTrans.StopTime);
                                        
                                        // ===== QUAN TRỌNG: Xử lý WalletTransaction để trừ tiền =====
                                        var oldWalletTransaction = dbContext.WalletTransactions
                                            .Where(wt => wt.TransactionId == oldTrans.TransactionId)
                                            .FirstOrDefault();
                                        
                                        if (oldWalletTransaction != null)
                                        {
                                            // Tính tiền cho phần đã sạc (nếu có)
                                            if (oldTrans.MeterStop.HasValue && oldTrans.MeterStart.HasValue)
                                            {
                                                decimal meterValue = (decimal)(oldTrans.MeterStop.Value - oldTrans.MeterStart.Value);
                                                oldWalletTransaction.meterValue = meterValue;
                                                oldWalletTransaction.stopMethod = "DeAuthorized";
                                                
                                                // Tính Amount nếu có ExchangeRate
                                                if (oldWalletTransaction.ExchangeRate.HasValue && oldWalletTransaction.ExchangeRate.Value > 0)
                                                {
                                                    decimal effectiveMeterKwh = meterValue;
                                                    if (oldWalletTransaction.chargeType == "valueControl" && oldWalletTransaction.upperLimit.HasValue && oldWalletTransaction.upperLimit.Value > 0 && effectiveMeterKwh > oldWalletTransaction.upperLimit.Value)
                                                        effectiveMeterKwh = oldWalletTransaction.upperLimit.Value;
                                                    oldWalletTransaction.Amount = effectiveMeterKwh * oldWalletTransaction.ExchangeRate.Value;
                                                    
                                                    // Tính newBalance và cap tránh âm tiền
                                                    if (oldWalletTransaction.currentBalance.HasValue)
                                                    {
                                                        oldWalletTransaction.newBalance = oldWalletTransaction.currentBalance.Value - oldWalletTransaction.Amount;
                                                        if (oldWalletTransaction.newBalance.Value < 0)
                                                        {
                                                            oldWalletTransaction.Amount = oldWalletTransaction.currentBalance.Value;
                                                            oldWalletTransaction.newBalance = 0;
                                                            Logger.LogWarning("StartTransaction => Đã cap tránh âm tiền khi đóng transaction cũ. TransactionId={0}", oldTrans.TransactionId);
                                                        }
                                                        
                                                        // Cập nhật UserApp.Balance
                                                        var userApp = dbContext.UserApps.Find(oldTrans.StartTagId);
                                                        if (userApp != null && oldWalletTransaction.newBalance.HasValue)
                                                        {
                                                            userApp.Balance = oldWalletTransaction.newBalance.Value;
                                                            Logger.LogInformation("StartTransaction => Đã cập nhật balance cho UserApp '{0}': {1} -> {2} (trừ {3} từ transaction cũ)", 
                                                                oldTrans.StartTagId, oldWalletTransaction.currentBalance.Value, oldWalletTransaction.newBalance.Value, oldWalletTransaction.Amount);
                                                        }
                                                    }
                                                }
                                                else
                                                {
                                                    // Nếu không có ExchangeRate, không trừ tiền
                                                    oldWalletTransaction.Amount = 0;
                                                    if (oldWalletTransaction.currentBalance.HasValue)
                                                    {
                                                        oldWalletTransaction.newBalance = oldWalletTransaction.currentBalance.Value;
                                                    }
                                                    Logger.LogWarning("StartTransaction => TransactionId={0} không có ExchangeRate, không trừ tiền", oldTrans.TransactionId);
                                                }
                                            }
                                            else
                                            {
                                                // Nếu không có meterValue, không trừ tiền
                                                oldWalletTransaction.meterValue = 0;
                                                oldWalletTransaction.Amount = 0;
                                                oldWalletTransaction.stopMethod = "DeAuthorized";
                                                if (oldWalletTransaction.currentBalance.HasValue)
                                                {
                                                    oldWalletTransaction.newBalance = oldWalletTransaction.currentBalance.Value;
                                                }
                                            }
                                        }
                                        
                                        // Xóa TransactionVirtual của transaction cũ nếu có
                                        var oldTv = dbContext.TransactionVirtuals
                                            .Where(tv => tv.TransactionId == oldTrans.TransactionId)
                                            .FirstOrDefault();
                                        if (oldTv != null)
                                        {
                                            dbContext.Remove(oldTv);
                                            Logger.LogInformation("StartTransaction => Đã xóa TransactionVirtual của transaction cũ: TransactionId={0}", oldTrans.TransactionId);
                                        }
                                    }
                                    
                                    dbContext.SaveChanges();
                                    Logger.LogInformation("StartTransaction => Đã đóng {0} transaction cũ và clear ID. ConnectorId={1} sẵn sàng cho transaction mới.", 
                                        oldTransactions.Count, connectorId);
                                }
                            }

                            Transaction transaction = new Transaction();
                            transaction.ChargePointId = ChargePointStatus?.Id;
                            tagid = transaction.ChargePointId;
                            transaction.ConnectorId = startTransactionRequest.ConnectorId;
                            transaction.StartTagId = idTag;
                            transaction.StartTime = startTransactionRequest.Timestamp.UtcDateTime;
                            transaction.MeterStart = (double)startTransactionRequest.MeterStart / 1000; // Meter value here is always Wh
                            transaction.StartResult = startTransactionResponse.IdTagInfo.Status.ToString();
                            dbContext.Add<Transaction>(transaction);
                            dbContext.SaveChanges();

                            // Return DB-ID as transaction ID
                            startTransactionResponse.TransactionId = transaction.TransactionId;
                            
                            //Check if Tagid was userappid (UserApp - sạc qua ví)
                            var checkUser = dbContext.UserApps.Find(transaction.StartTagId);
                            if (checkUser != null)
                            {
                                WalletTransaction WalletTransaction = new WalletTransaction();
                                WalletTransaction.DateCreate= transaction.StartTime;
                                WalletTransaction.UserAppId = transaction.StartTagId;
                                WalletTransaction.TransactionId = transaction.TransactionId;
                                
                                // Lấy giá điện: Ưu tiên từ ChargePoint, nếu không có thì lấy từ bảng Unitprice chung
                                decimal exchangeRate = 0;
                                var chargePoint = dbContext.ChargePoints.Find(transaction.ChargePointId);
                                if (chargePoint != null && chargePoint.Unitprice.HasValue && chargePoint.Unitprice.Value > 0)
                                {
                                    // Dùng giá riêng của ChargePoint
                                    exchangeRate = chargePoint.Unitprice.Value;
                                }
                                else
                                {
                                    // Fallback về giá chung từ bảng Unitprice
                                    var getExchangeRate = dbContext.Unitprices.Where(m => m.IsActive == 1).FirstOrDefault();
                                    exchangeRate = getExchangeRate != null ? getExchangeRate.Price : 0;
                                }
                                
                                // Kiểm tra giá hợp lệ: không có giá thì từ chối sạc, không tạo WalletTransaction
                                if (exchangeRate <= 0)
                                {
                                    Logger.LogError("StartTransaction => Không tìm thấy giá điện cho ChargePoint '{0}'. Từ chối sạc. TransactionId: {1}", transaction.ChargePointId, transaction.TransactionId);
                                    dbContext.Remove(transaction);
                                    dbContext.SaveChanges();
                                    if (connectorId > 0)
                                        UpdateConnectorStatus(connectorId, ConnectorStatusEnum.Available.ToString(), DateTimeOffset.UtcNow, null, null);
                                    startTransactionResponse.IdTagInfo.Status = IdTagInfoStatus.Blocked;
                                    msgOut.JsonPayload = JsonConvert.SerializeObject(startTransactionResponse);
                                    return errorCode;
                                }
                                
                                WalletTransaction.ExchangeRate = exchangeRate;
                                // Lấy balance từ UserApp (đã có sẵn từ checkUser, nhưng lấy lại để đảm bảo có dữ liệu mới nhất)
                                UserApp us = dbContext.UserApps.Find(WalletTransaction.UserAppId);
                                WalletTransaction.currentBalance = us != null ? us.Balance : 0;
                                
                                // ===== QUAN TRỌNG: Bắt buộc balance >= 50.000 mới tạo WalletTransaction (thống nhất với API) =====
                                const decimal MinBalanceToStartCharge = 50000m;
                                if (WalletTransaction.currentBalance.HasValue && WalletTransaction.currentBalance.Value < MinBalanceToStartCharge)
                                {
                                    Logger.LogError("StartTransaction => UserApp '{0}' có balance={1} < {2}. Không thể tạo WalletTransaction. TransactionId: {3}", 
                                        WalletTransaction.UserAppId, WalletTransaction.currentBalance.Value, MinBalanceToStartCharge, transaction.TransactionId);
                                    
                                    // Xóa transaction đã tạo vì không hợp lệ
                                    dbContext.Remove(transaction);
                                    dbContext.SaveChanges();
                                    if (connectorId > 0)
                                        UpdateConnectorStatus(connectorId, ConnectorStatusEnum.Available.ToString(), DateTimeOffset.UtcNow, null, null);
                                    // Từ chối transaction
                                    startTransactionResponse.IdTagInfo.Status = IdTagInfoStatus.Blocked;
                                    Logger.LogWarning("StartTransaction => Đã xóa transaction không hợp lệ (balance < {0}). TransactionId: {1}", MinBalanceToStartCharge, transaction.TransactionId);
                                    
                                    // Không tiếp tục xử lý WalletTransaction
                                    msgOut.JsonPayload = JsonConvert.SerializeObject(startTransactionResponse);
                                    return errorCode;
                                }
                                
                                // Chỉ xử lý nếu có giá hợp lệ VÀ balance > 0
                                if (exchangeRate > 0 && WalletTransaction.currentBalance.HasValue && WalletTransaction.currentBalance.Value > 0)
                                {
                                    if (WalletTransaction.currentBalance.Value > (92 * exchangeRate))
                                    {
                                        WalletTransaction.chargeType = "normal";
                                    }
                                    else
                                    {
                                        WalletTransaction.chargeType = "valueControl";
                                        WalletTransaction.upperLimit = WalletTransaction.currentBalance.Value / exchangeRate;
                                    }
                                }
                                else
                                {
                                    // Nếu không có giá hoặc không có balance, đặt mặc định
                                    // Lưu ý: upperLimit = NULL nghĩa là sạc không giới hạn (normal), vẫn tính tiền bình thường
                                    Logger.LogWarning("StartTransaction => ExchangeRate={0} hoặc currentBalance=null. TransactionId: {1}. Đặt chargeType=normal, upperLimit=NULL để sạc không giới hạn", exchangeRate, transaction.TransactionId);
                                    WalletTransaction.chargeType = "normal";
                                    WalletTransaction.upperLimit = null; // NULL = sạc không giới hạn, tính tiền bình thường
                                }
                                dbContext.WalletTransactions.Add(WalletTransaction);
                                dbContext.SaveChanges();

                                //first delete record
                             
                                //Create transaction Virtual 
                                // Lưu ý: TransactionVirtual.upperLimit là decimal (không nullable), nên set 0 nếu WalletTransaction.upperLimit là NULL
                                TransactionVirtual tv = new TransactionVirtual();
                                tv.TransactionId = transaction.TransactionId;
                                tv.StartTagId = transaction.StartTagId;
                                tv.StartTime = transaction.StartTime;
                                tv.ChargePointId = transaction.ChargePointId;
                                // upperLimit có thể NULL trong WalletTransaction, nhưng TransactionVirtual.upperLimit không nullable nên set 0
                                tv.upperLimit = WalletTransaction.upperLimit.HasValue ? WalletTransaction.upperLimit.Value : 0;
                                dbContext.TransactionVirtuals.Add(tv);
                                dbContext.SaveChanges();
                                                          
                                //If a meter control
                                //Trigger Datatranfer
                                //Uperlimit wallet
                                // Lưu ý: upperLimit có thể NULL, cần kiểm tra HasValue trước khi sử dụng
                                if (WalletTransaction.chargeType == "valueControl" && WalletTransaction.upperLimit.HasValue && WalletTransaction.upperLimit.Value > 0)
                                {
                                    // Lớp bảo vệ upperLimit: gửi limit thấp hơn một chút (buffer VND + buffer kWh), thống nhất 15.000 VND với MeterValues
                                    const decimal BalanceBufferVnd = 15000m;
                                    const decimal KwhBuffer = 0.05m;
                                    var getChargePointInfo = dbContext.ChargePoints.Where(m => m.ChargePointId == transaction.ChargePointId).FirstOrDefault();
                                    if (getChargePointInfo != null)
                                    {
                                        bool isJuhang = getChargePointInfo.ChargePointModel != null && getChargePointInfo.ChargePointModel.ToLower().Contains("juhang");
                                        bool isTonheOrBenny = getChargePointInfo.ChargePointModel != null
                                            && (getChargePointInfo.ChargePointModel.ToLower().Contains("tonhe") || getChargePointInfo.ChargePointModel.ToLower().Contains("benny"));

                                        if (isJuhang)
                                        {
                                            var barcodeId = transaction.ChargePointId + transaction.ConnectorId.ToString();
                                            decimal balanceAfterBuffer = WalletTransaction.currentBalance.Value - BalanceBufferVnd;
                                            if (balanceAfterBuffer <= 0) balanceAfterBuffer = 0;
                                            decimal upperLimitFromBalance = WalletTransaction.ExchangeRate.Value > 0 ? balanceAfterBuffer / WalletTransaction.ExchangeRate.Value : 0;
                                            decimal upperLimitValue = upperLimitFromBalance - KwhBuffer;
                                            if (upperLimitValue > 0)
                                            {
                                                SetChargingProfileForJuhang(barcodeId, upperLimitValue, transaction.TransactionId);
                                                Logger.LogInformation("StartTransaction => Juhang: gửi SetChargingProfile upperLimit={0} kWh (buffer VND={1}, kWh={2}). TransactionId={3}", upperLimitValue, BalanceBufferVnd, KwhBuffer, transaction.TransactionId);
                                            }
                                            else
                                            {
                                                Logger.LogWarning("StartTransaction => Juhang upperLimit quá nhỏ ({0}), không gửi SetChargingProfile. TransactionId: {1}", upperLimitValue, transaction.TransactionId);
                                            }
                                        }
                                        else if (!isTonheOrBenny)
                                        {
                                            var barcodeId = transaction.ChargePointId + transaction.ConnectorId.ToString();
                                            decimal balanceAfterBuffer = WalletTransaction.currentBalance.Value - BalanceBufferVnd;
                                            if (balanceAfterBuffer <= 0) balanceAfterBuffer = 0;
                                            decimal upperLimitFromBalance = WalletTransaction.ExchangeRate.Value > 0 ? balanceAfterBuffer / WalletTransaction.ExchangeRate.Value : 0;
                                            decimal upperLimitValue = upperLimitFromBalance - KwhBuffer;
                                            if (upperLimitValue > 0)
                                            {
                                                ChargingSchedule(barcodeId, upperLimitValue, transaction.TransactionId);
                                                Logger.LogInformation("StartTransaction => Lớp bảo vệ upperLimit: gửi ChargingSchedule upperLimit={0} kWh (buffer VND={1}, kWh={2}). TransactionId={3}", upperLimitValue, BalanceBufferVnd, KwhBuffer, transaction.TransactionId);
                                            }
                                            else
                                            {
                                                Logger.LogWarning("StartTransaction => upperLimit quá nhỏ ({0}), không gửi ChargingSchedule. TransactionId: {1}", upperLimitValue, transaction.TransactionId);
                                            }
                                        }
                                    }
                                }
                            }
                            // ===== CHỨC NĂNG QR CODE (VNPay) ĐÃ BỊ VÔ HIỆU HÓA =====
                            //Kiểm tra trường hợp QR_Payment
                            /*
                            if (checkUser == null)
                            {
                                var ChargeTags = dbContext.ChargeTags.Where(m => m.TagId == transaction.StartTagId && m.TagType == "QR_Payment").FirstOrDefault();
                                if (ChargeTags != null)
                                {

                                    //Create QRTransaction
                                    TransactionVirtualQR TransactionVirtualQR = dbContext.TransactionVirtualQRs.ToList().Where(m => m.ChargePointId == transaction.ChargePointId && m.ConnectorId == transaction.ConnectorId).LastOrDefault();
                                    TransactionVirtualQR.TransactionId = transaction.TransactionId;
                                    dbContext.SaveChanges();
                                     var getExchangeRate = dbContext.Unitprices.Where(m => m.IsActive == 1).FirstOrDefault();
                                    QRTransaction QRTransaction = new QRTransaction();
                                    QRTransaction.ExchangeRate= getExchangeRate != null ? getExchangeRate.Price : 0;
                                    QRTransaction.TransactionId = transaction.TransactionId;
                                    QRTransaction.QrTagId = ChargeTags.TagId;
                                    QRTransaction.StartTime = transaction.StartTime;
                                    QRTransaction.ChargingAmount = TransactionVirtualQR.Amount;
                                    QRTransaction.EndTime = DateTime.Now;
                                    QRTransaction.UpperLimit = TransactionVirtualQR != null ? TransactionVirtualQR.Amount / QRTransaction.ExchangeRate : 0 ;
                                    QRTransaction.QrSource = "VNPay";
                                    QRTransaction.qrTrace = TransactionVirtualQR.qrTrace;
                                    dbContext.QRTransactions.Add(QRTransaction);
                                    //Update
                                   
                                    dbContext.SaveChanges();
                                    var terminalId = transaction.ChargePointId + transaction.ConnectorId.ToString();
                                    ChargingSchedule(terminalId, decimal.Parse(QRTransaction.UpperLimit.ToString()), transaction.TransactionId);

                                }

                            }
                            */
                        }

                    }
                    catch (Exception exp)
                    {
                        using (OCPPCoreContext dbContext = new OCPPCoreContext(Configuration))
                        {
                            MessageLog msg = new MessageLog();
                            msg.LogTime = DateTime.Now;
                            msg.ChargePointId = ChargePointStatus?.Id;
                            msg.ConnectorId = startTransactionRequest.ConnectorId;
                            msg.Message = "Bat đầu sạc";
                            msg.Result = "Thành công";

                            msg.ErrorCode = exp.Message;
                            dbContext.SaveChanges();
                        }
                          
                        Logger.LogError(exp, "StartTransaction => Exception writing transaction: chargepoint={0} / tag={1}", ChargePointStatus?.Id, idTag);
                        errorCode = ErrorCodes.InternalError;
                    }
                }

                msgOut.JsonPayload = JsonConvert.SerializeObject(startTransactionResponse);

                Logger.LogTrace("StartTransaction => Response serialized");
            }
            catch (Exception exp)
            {
                Logger.LogError(exp, "StartTransaction => Exception: {0}", exp.Message);
                errorCode = ErrorCodes.FormationViolation;
            }

            WriteMessageLog(ChargePointStatus?.Id, connectorId, msgIn.Action, startTransactionResponse.IdTagInfo?.Status.ToString(), errorCode);
            return errorCode;
        }
        public async Task ChargingSchedule(string ChargePointId,decimal upperLimit, int TransactionId)
        {
            var serverUrl = "http://103.77.167.17:8481";
           // var serverUrl = "http://localhost:8081";
            string apiUrlTrigger = serverUrl + "/ChargingSchedule?id=" + ChargePointId + "&upperLimit=" + upperLimit + "&transactionid=" + TransactionId + "";
            HttpResponseMessage responseTrigger = await _httpClient.GetAsync(apiUrlTrigger);
        }
        /// <summary>
        /// Gửi SetChargingProfile (OCPP 1.6) cho trụ Juhang qua middleware. Trụ Juhang dùng TxProfile để giới hạn phiên sạc theo upperLimit (kWh).
        /// </summary>
        public async Task SetChargingProfileForJuhang(string ChargePointId, decimal upperLimit, int TransactionId)
        {
            var serverUrl = "http://103.77.167.17:8481";
            string apiUrl = serverUrl + "/SetChargingProfile?id=" + Uri.EscapeDataString(ChargePointId) + "&upperLimit=" + upperLimit.ToString(System.Globalization.CultureInfo.InvariantCulture) + "&transactionid=" + TransactionId;
            HttpResponseMessage response = await _httpClient.GetAsync(apiUrl);
        }
        public async Task SendMessageDevice(string userTo)
        {
            string serverKey = "AAAAvXGNK6E:APA91bG7sMWvF2POHTv4RbGIbkH9fA0v_lDvS2GTTvMD5lJamx7mLR_Df6rPusr9JHD4J3ZSxiKQyfCIG9uqcXX2lDPbO0c7CK_zUnrfu_UTg69jHe_ruaVeQIL448HDTF1dLIo0JRFw";
            string fcmUrl = "https://fcm.googleapis.com/fcm/send";

            var jsonMessage = @"{
           ""to"": """ + userTo + @""",
            ""notification"": {
                ""title"": ""Thông báo"",
                ""body"": ""Xe đang bắt đầu sạc, vui lòng chờ...""
            },
            ""data"": {
                ""promo_type"": ""CHARGE_START"",
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
