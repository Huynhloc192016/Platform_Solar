
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
using Newtonsoft.Json.Linq;
using Microsoft.EntityFrameworkCore;

namespace FocusEV.OCPP.Server
{
    public partial class ControllerOCPP16
    {
        public bool checkTime(DateTime tm1,DateTime tm2)
        {
            return tm1.Date == tm2.Date && tm1.Hour == tm2.Hour && tm1.Minute == tm2.Minute;
        }
        public string HandleStopTransaction(OCPPMessage msgIn, OCPPMessage msgOut)
        {
         

            string errorCode = null;
            LogStopTransaction logStopTransaction = null;
            StopTransactionResponse stopTransactionResponse = new StopTransactionResponse();
            logStopTransaction = new LogStopTransaction();
            try
            {
                Logger.LogTrace("Processing stopTransaction request...");
                StopTransactionRequest stopTransactionRequest = JsonConvert.DeserializeObject<StopTransactionRequest>(msgIn.JsonPayload);
                Logger.LogTrace("StopTransaction => Message deserialized");
                
                OCPPCoreContext dbContextlog = new OCPPCoreContext(Configuration);
                try
                {
                  
                    logStopTransaction.Timestart = DateTime.Now;
                    logStopTransaction.Descriptions += "State 1 started | ";
                    logStopTransaction.Timestop = DateTime.Now;
                    dbContextlog.LogStopTransactions.Add(logStopTransaction);
                    logStopTransaction.StopTransactionResponse = msgIn.JsonPayload;
                    logStopTransaction.TransactionId = stopTransactionRequest.TransactionId;
                    var findLogstop = dbContextlog.LogStopTransactions.Any(m => m.TransactionId == stopTransactionRequest.TransactionId);
                    if (!findLogstop)
                    {
                        dbContextlog.SaveChanges();
                    }

                }
                catch (Exception ex)
                {

                }
               
                string idTag = CleanChargeTagId(stopTransactionRequest.IdTag, Logger);

                if (string.IsNullOrEmpty(idTag) )
                {
                    using (OCPPCoreContext dbContext = new OCPPCoreContext(Configuration))
                    {
                        var transac = dbContext.Transactions.Find(stopTransactionRequest.TransactionId);
                        idTag = transac.StartTagId;
                    }
                       
                }

                if (string.IsNullOrWhiteSpace(idTag))
                {
                    // no RFID-Tag => accept request
                    stopTransactionResponse.IdTagInfo = new IdTagInfo();
                    stopTransactionResponse.IdTagInfo.Status = IdTagInfoStatus.Accepted;
                    Logger.LogInformation("StopTransaction => no charge tag => Status: {0}", stopTransactionResponse.IdTagInfo.Status);
                }
                else
                {
                    stopTransactionResponse.IdTagInfo = new IdTagInfo();
                    stopTransactionResponse.IdTagInfo.ExpiryDate = MaxExpiryDate;

                    try
                    {
                        using (OCPPCoreContext dbContext = new OCPPCoreContext(Configuration))
                        {
                            ChargeTag ct = dbContext.Find<ChargeTag>(idTag);
                            if (ct != null)
                            {
                                if (ct.ExpiryDate.HasValue) stopTransactionResponse.IdTagInfo.ExpiryDate = ct.ExpiryDate.Value;
                                stopTransactionResponse.IdTagInfo.ParentIdTag = ct.ParentTagId;
                                if (ct.Blocked.HasValue && ct.Blocked.Value)
                                {
                                    stopTransactionResponse.IdTagInfo.Status = IdTagInfoStatus.Blocked;
                                }
                                else if (ct.ExpiryDate.HasValue && ct.ExpiryDate.Value < DateTime.Now)
                                {
                                    stopTransactionResponse.IdTagInfo.Status = IdTagInfoStatus.Expired;
                                }
                                else
                                {
                                    stopTransactionResponse.IdTagInfo.Status = IdTagInfoStatus.Accepted;
                                }
                            }
                            else
                            {
                                stopTransactionResponse.IdTagInfo.Status = IdTagInfoStatus.Invalid;
                            }

                            Logger.LogInformation("StopTransaction => RFID-tag='{0}' => Status: {1}", idTag, stopTransactionResponse.IdTagInfo.Status);

                            logStopTransaction.Descriptions += "| State 2" + " | ";
                            dbContextlog.SaveChanges();
                        }


                    }
                    catch (Exception exp)
                    {
                        Logger.LogError(exp, "StopTransaction => Exception reading charge tag ({0}): {1}", idTag, exp.Message);
                        stopTransactionResponse.IdTagInfo.Status = IdTagInfoStatus.Invalid;
                        logStopTransaction.Descriptions += "| State 2" + exp.Message+" | ";
                        dbContextlog.SaveChanges();
                    }
                }

                if (stopTransactionResponse.IdTagInfo.Status == IdTagInfoStatus.Accepted)
                {
                    try
                    {
                        using (OCPPCoreContext dbContext = new OCPPCoreContext(Configuration))
                        {
                            // Bước 1: Tìm transaction theo TransactionId từ request
                            Transaction transaction = dbContext.Find<Transaction>(stopTransactionRequest.TransactionId);
                            int? connectorIdFromTransaction = null;

                            // Nếu tìm thấy transaction, lưu ConnectorId để dùng cho fallback
                            if (transaction != null)
                            {
                                connectorIdFromTransaction = transaction.ConnectorId;
                            }

                            // Bước 2: Kiểm tra transaction có hợp lệ không
                            // Lưu ý đặc biệt:
                            // - Có những trường hợp transaction đã bị "đóng tạm" (pre-close) với các lý do nội bộ như:
                            //     + "DeAuthorized": trong HandleStartTransaction khi bắt đầu phiên mới trên cùng connector.
                            //     + "Timeout": trong APIController khi app timeout nhưng trạm vẫn có thể tiếp tục và gửi StopTransaction thật sau đó.
                            // - Khi StopTransaction thật sự tới sau đó (có meterStop chính xác), ta vẫn cần cập nhật lại
                            //   MeterStop / StopReason để không làm mất sản lượng đã sạc.
                            // => Nếu StopReason hiện tại là "DeAuthorized" hoặc "Timeout", cho phép tiếp tục dùng transaction này,
                            //    KHÔNG ép fallback sang transaction khác và KHÔNG bỏ qua cập nhật.
                            bool isPreClosedWithAutoReason = transaction != null
                                && transaction.StopTime.HasValue
                                && transaction.TransactionId == stopTransactionRequest.TransactionId
                                && (
                                       string.Equals(transaction.StopReason, "DeAuthorized", StringComparison.InvariantCultureIgnoreCase)
                                    || string.Equals(transaction.StopReason, "Timeout", StringComparison.InvariantCultureIgnoreCase)
                                   );

                            // QUAN TRỌNG: Lưu lại transaction ban đầu nếu nó là pre-close hợp lệ để có thể restore sau này
                            Transaction originalPreClosedTransaction = null;
                            if (isPreClosedWithAutoReason)
                            {
                                originalPreClosedTransaction = transaction;
                                Logger.LogInformation("StopTransaction => Lưu lại transaction ban đầu (id={0}) với StopReason='{1}' để có thể restore nếu không tìm thấy fallback", 
                                    transaction.TransactionId, transaction.StopReason);
                            }

                            bool requiresFallbackTransaction = transaction == null
                                || transaction.ChargePointId != ChargePointStatus.Id
                                || (transaction.StopTime.HasValue && !isPreClosedWithAutoReason);

                            if (requiresFallbackTransaction)
                            {
                                Logger.LogWarning("StopTransaction => Unknown or closed transaction id={0}. ChargePointId={1}", stopTransactionRequest.TransactionId, ChargePointStatus.Id);
                                
                                // QUAN TRỌNG: Khi tìm transaction fallback, PHẢI filter theo ConnectorId để tránh lấy nhầm transaction của xe khác
                                // Nếu không có ConnectorId từ transaction ban đầu, thử lấy từ transaction đang mở
                                if (!connectorIdFromTransaction.HasValue)
                                {
                                    // Thử lấy ConnectorId từ transaction đang mở (chưa có StopTime) của ChargePoint này
                                    var activeTransaction = dbContext.Transactions
                                        .Where(t => t.ChargePointId == ChargePointStatus.Id && !t.StopTime.HasValue)
                                        .OrderByDescending(t => t.TransactionId)
                                        .FirstOrDefault();
                                    if (activeTransaction != null)
                                    {
                                        connectorIdFromTransaction = activeTransaction.ConnectorId;
                                        Logger.LogInformation("StopTransaction => Lấy ConnectorId={0} từ transaction đang mở (TransactionId={1}) để tìm transaction fallback", 
                                            connectorIdFromTransaction.Value, activeTransaction.TransactionId);
                                    }
                                }

                                // Tìm transaction fallback: PHẢI filter theo cả ChargePointId VÀ ConnectorId để tránh lấy nhầm
                                Transaction fallbackTransaction = null;
                                if (connectorIdFromTransaction.HasValue)
                                {
                                    fallbackTransaction = dbContext.Transactions
                                        .Where(t => t.ChargePointId == ChargePointStatus.Id 
                                                 && t.ConnectorId == connectorIdFromTransaction.Value
                                                 && !t.StopTime.HasValue) // Chỉ lấy transaction chưa đóng
                                        .OrderByDescending(t => t.TransactionId)
                                        .FirstOrDefault();
                                    
                                    if (fallbackTransaction != null)
                                    {
                                        Logger.LogInformation("StopTransaction => Tìm thấy transaction fallback: TransactionId={0}, ConnectorId={1}, StartTagId={2}", 
                                            fallbackTransaction.TransactionId, fallbackTransaction.ConnectorId, fallbackTransaction.StartTagId);
                                    }
                                }
                                else
                                {
                                    // Nếu không có ConnectorId, chỉ tìm theo ChargePointId (trường hợp cuối cùng, không khuyến khích)
                                    Logger.LogWarning("StopTransaction => Không có ConnectorId, tìm transaction theo ChargePointId (có thể lấy nhầm nếu có nhiều xe sạc cùng lúc)");
                                    fallbackTransaction = dbContext.Transactions
                                        .Where(t => t.ChargePointId == ChargePointStatus.Id && !t.StopTime.HasValue)
                                        .OrderByDescending(t => t.TransactionId)
                                        .FirstOrDefault();
                                }
                                if (fallbackTransaction != null)
                                {
                                    transaction = fallbackTransaction;
                                    if (transaction.StopTime.HasValue)
                                    {
                                        // Kiểm tra lại isPreClosedWithAutoReason cho fallback transaction
                                        bool isFallbackPreClosed = string.Equals(transaction.StopReason, "DeAuthorized", StringComparison.InvariantCultureIgnoreCase)
                                            || string.Equals(transaction.StopReason, "Timeout", StringComparison.InvariantCultureIgnoreCase);
                                        
                                        if (isFallbackPreClosed)
                                        {
                                            // Trường hợp đặc biệt: transaction fallback đã bị pre-close với DeAuthorized hoặc Timeout.
                                            // Cho phép tiếp tục sử dụng transaction này để cập nhật lại MeterStop/StopReason từ StopTransaction thật.
                                            Logger.LogInformation("StopTransaction => Transaction fallback (id={0}) was pre-closed with StopReason='{1}'. Will reuse and update with real StopTransaction data.", transaction.TransactionId, transaction.StopReason);
                                            logStopTransaction.Descriptions += "| State 3 (reuse pre-closed fallback transaction: " + transaction.StopReason + ") | ";
                                            dbContextlog.SaveChanges();
                                        }
                                        else
                                        {
                                            Logger.LogTrace("StopTransaction => Last transaction (id={0}) is already closed ", transaction.TransactionId);
                                            ResponseLog ResponseLog = new ResponseLog();
                                            ResponseLog.CreateDate = DateTime.Now;
                                            ResponseLog.isType = "Thiết lập lại transaction = null";
                                            ResponseLog.isResponse = "transaction.ChargePointId:" + transaction.ChargePointId + " ChargePointStatus.Id:" + ChargePointStatus.Id + " StartTagId " + transaction.StartTagId + " StartTime " + transaction.StartTime + " transaction.StopTime:" + stopTransactionRequest.Timestamp + " transaction.TransactionId:" + transaction.TransactionId + " stopTransactionRequest.TransactionId:" + stopTransactionRequest.TransactionId + " meterstop " + stopTransactionRequest.MeterStop + " stoptagid " + stopTransactionRequest.IdTag + " Meter start " + transaction.MeterStart;
                                            dbContext.ResponseLogs.Add(ResponseLog);
                                            dbContext.SaveChanges();

                                            transaction = null;

                                            logStopTransaction.Descriptions += "| State 3" + " | ";
                                            dbContextlog.SaveChanges();                                       
                                        }
                                    }
                                    else
                                    {
                                        Logger.LogInformation("INS_log [154] Tìm đơn last transaction => KHÔNG có StopTime.HasValue => đơn đúng =>  lastTransID={0} / requestStopTransID={1}", transaction.TransactionId, stopTransactionRequest.TransactionId);  
                                    }
                                }
                                else
                                {
                                    // QUAN TRỌNG: Nếu không tìm thấy fallback transaction, và transaction ban đầu là pre-close hợp lệ, thì giữ lại transaction ban đầu
                                    if (originalPreClosedTransaction != null)
                                    {
                                        transaction = originalPreClosedTransaction;
                                        Logger.LogInformation("StopTransaction => Không tìm thấy fallback transaction. Restore lại transaction ban đầu (id={0}) với StopReason='{1}' để cập nhật MeterStop từ StopTransaction thật.", 
                                            transaction.TransactionId, transaction.StopReason);
                                        logStopTransaction.Descriptions += "| State 3 (restore original pre-closed transaction: " + transaction.StopReason + ") | ";
                                        dbContextlog.SaveChanges();
                                    }
                                    else
                                    {
                                        logStopTransaction.Descriptions += "| State 3 " + "StopTransaction => Found no transaction for charge point " + ChargePointStatus.Id+ " | ";
                                        dbContextlog.SaveChanges();
                                        Logger.LogTrace("StopTransaction => Found no transaction for charge point '{0}'", ChargePointStatus.Id);
                                    }
                                }
                            }

                            if (transaction != null)
                            {
                                logStopTransaction.Descriptions += "| State 4" + " | ";
                                dbContextlog.SaveChanges();
                                if (transaction.ConnectorId > 0)
                                {
                                    // Update meter value in db connector status 
                                    UpdateConnectorStatus(transaction.ConnectorId, null, null, (double)stopTransactionRequest.MeterStop / 1000, stopTransactionRequest.Timestamp);

                                    try
                                    {
                                        var getTagId = transaction.StartTagId;
                                        var userApp = dbContext.UserApps.Find(getTagId);
                                        string body = "";
                                        WalletTransaction findwallet = dbContext.WalletTransactions.Where(m => m.TransactionId == transaction.TransactionId).FirstOrDefault();
                                        //App used
                                        if (findwallet != null)
                                        {
                                            if (userApp != null)
                                            {
                                                if (findwallet.chargeType == "normal")
                                                {
                                                    SendMessage(userApp.TokenNotify, "Quý khách đã sạc thành công, vui lòng rút sạc");
                                                }
                                                if (findwallet.chargeType == "valueControl")
                                                {
                                                    if (transaction.StopReason != "Remote")
                                                        SendMessage(userApp.TokenNotify, "Đơn  sạc thành công, vui lòng rút sạc");

                                                    else
                                                        SendMessage(userApp.TokenNotify, "Đơn sạc đã dừng do tiền trong ví không đủ, vui lòng nạp thêm và thực hiện lại đơn sạc");
                                                }
                                            }
                                        }
                                        //QRCode used
                                        else
                                        {
                                            if (userApp != null)
                                                SendMessage(userApp.TokenNotify, "Quý khách đã sạc thành công, vui lòng rút sạc");
                                        }

                                    }
                                    catch (Exception ex)
                                    {
                                        logStopTransaction.Descriptions += "| State 4" + ex.Message+ "" + " | ";
                                        dbContextlog.SaveChanges();

                                        Logger.LogError("StopTransaction => lỗi mobile app : '{0}'", ex.Message);
                                        ResponseLog ResponseLog = new ResponseLog();
                                        ResponseLog.CreateDate = DateTime.Now;
                                        ResponseLog.isType = "Check lỗi remote stop {Thông báo app}";
                                        ResponseLog.isResponse = ex.Message;
                                        dbContext.ResponseLogs.Add(ResponseLog);
                                        dbContext.SaveChanges();
                                    }
                                }

                                // QUAN TRỌNG: Kiểm tra StartTagId để đảm bảo đúng transaction (tránh nhầm khi có nhiều xe sạc cùng lúc)
                                // Nếu có idTag từ request, kiểm tra xem có khớp với StartTagId không
                                bool valid = true;
                                if (!string.IsNullOrWhiteSpace(idTag) && !string.IsNullOrWhiteSpace(transaction.StartTagId))
                                {
                                    if (!string.Equals(transaction.StartTagId, idTag, StringComparison.InvariantCultureIgnoreCase))
                                    {
                                        // Tags khác nhau => kiểm tra xem có cùng nhóm không (ParentTagId)
                                        ChargeTag startTag = dbContext.Find<ChargeTag>(transaction.StartTagId);
                                        if (startTag != null)
                                        {
                                            if (!string.Equals(startTag.ParentTagId, stopTransactionResponse.IdTagInfo.ParentIdTag, StringComparison.InvariantCultureIgnoreCase))
                                            {
                                                Logger.LogWarning("StopTransaction => StartTagId ('{0}') và StopTagId ('{1}') không khớp và không cùng nhóm! TransactionId={2}, ConnectorId={3}. Có thể là transaction của xe khác!", 
                                                    transaction.StartTagId, idTag, transaction.TransactionId, transaction.ConnectorId);
                                                stopTransactionResponse.IdTagInfo.Status = IdTagInfoStatus.Invalid;
                                                valid = false;
                                            }
                                            else
                                            {
                                                Logger.LogInformation("StopTransaction => Different RFID-Tags but matching group ('{0}')", stopTransactionResponse.IdTagInfo.ParentIdTag);
                                            }
                                        }
                                        else
                                        {
                                            Logger.LogWarning("StopTransaction => StartTagId ('{0}') không tìm thấy trong ChargeTag. TransactionId={1}", transaction.StartTagId, transaction.TransactionId);
                                            // Vẫn cho phép tiếp tục nhưng log warning
                                        }
                                    }
                                }

                                logStopTransaction.Descriptions += "| Valid=" + valid + " | TransactionId=" + transaction.TransactionId + " | ConnectorId=" + transaction.ConnectorId + " | StartTagId=" + transaction.StartTagId + " | StopTagId=" + idTag + " | ";
                                dbContextlog.SaveChanges();

                                if (valid)
                                {
                                    logStopTransaction.Descriptions += "| State 5" + " | ";
                                    dbContextlog.SaveChanges();
                                    
                                    // QUAN TRỌNG: Sử dụng transaction đã tìm được và đã validate ở trên
                                    // Không cần tìm getlastTransaction nữa vì đã có transaction đúng
                                    if (stopTransactionRequest != null)
                                    {
                                        // Kiểm tra lại transaction có đúng TransactionId không (nếu request có TransactionId)
                                        if (transaction.TransactionId == stopTransactionRequest.TransactionId)
                                        {
                                            // TransactionId khớp => Cập nhật trực tiếp
                                            transaction.StopTagId = idTag;
                                            transaction.MeterStop = (double)stopTransactionRequest.MeterStop / 1000; // Meter value here is always Wh
                                            transaction.StopReason = stopTransactionRequest.Reason.ToString();
                                            transaction.StopTime = stopTransactionRequest.Timestamp.UtcDateTime;
                                            dbContext.SaveChanges();

                                            logStopTransaction.Descriptions += "| State 5_1 (TransactionId khớp, MeterStop=" + transaction.MeterStop + ") | ";
                                            dbContextlog.SaveChanges();
                                        }
                                        else
                                        {
                                            // TransactionId không khớp nhưng transaction đã được validate qua StartTagId và ConnectorId
                                            // Có thể do trạm sạc gửi sai TransactionId, nhưng transaction vẫn đúng
                                            Logger.LogWarning("StopTransaction => TransactionId không khớp: request={0}, found={1}. Nhưng transaction đã được validate qua StartTagId và ConnectorId, tiếp tục cập nhật.", 
                                                stopTransactionRequest.TransactionId, transaction.TransactionId);
                                            
                                            transaction.StopTagId = idTag;
                                            transaction.MeterStop = (double)stopTransactionRequest.MeterStop / 1000;
                                            transaction.StopReason = stopTransactionRequest.Reason.ToString();
                                            transaction.StopTime = stopTransactionRequest.Timestamp.UtcDateTime;
                                            dbContext.SaveChanges();

                                            logStopTransaction.Descriptions += "| State 5_2 (TransactionId không khớp nhưng đã validate, MeterStop=" + transaction.MeterStop + ") | ";
                                            dbContextlog.SaveChanges();
                                        }

                                        try
                                        {
                                            WalletTransaction WalletTransaction = dbContext.WalletTransactions.Where(m => m.TransactionId == transaction.TransactionId).FirstOrDefault();
                                            if (WalletTransaction != null)
                                            {
                                                // Idempotent: nếu đã thanh toán (newBalance có sẵn) thì bỏ qua, tránh trừ tiền hai lần.
                                                // Ngoại lệ: các đơn lỗi trước đây có Amount=0, meterValue=0 nhưng Transaction có MeterStop > MeterStart thì cho phép tính lại.
                                                bool hasValidSettlement = WalletTransaction.newBalance.HasValue
                                                    && !(WalletTransaction.Amount == 0
                                                         && WalletTransaction.meterValue == 0
                                                         && transaction.MeterStart.HasValue
                                                         && transaction.MeterStop.HasValue
                                                         && transaction.MeterStop.Value > transaction.MeterStart.Value);

                                                if (hasValidSettlement)
                                                {
                                                    Logger.LogInformation("StopTransaction => TransactionId={0} đã được thanh toán (newBalance có sẵn), bỏ qua cập nhật ví.", transaction.TransactionId);
                                                    goto SkipAmountCalculation;
                                                }
                                                // Kiểm tra ExchangeRate hợp lệ trước khi tính toán
                                                if (!WalletTransaction.ExchangeRate.HasValue || WalletTransaction.ExchangeRate.Value <= 0)
                                                {
                                                    Logger.LogError("StopTransaction => ExchangeRate không hợp lệ (null hoặc <= 0) cho TransactionId: {0}. ChargePointId: {1}", transaction.TransactionId, transaction.ChargePointId);
                                                    // Lấy giá từ ChargePoint hoặc Unitprice chung để tính lại
                                                    decimal exchangeRate = 0;
                                                    var chargePoint = dbContext.ChargePoints.Find(transaction.ChargePointId);
                                                    if (chargePoint != null && chargePoint.Unitprice.HasValue && chargePoint.Unitprice.Value > 0)
                                                    {
                                                        exchangeRate = chargePoint.Unitprice.Value;
                                                    }
                                                    else
                                                    {
                                                        var getExchangeRate = dbContext.Unitprices.Where(m => m.IsActive == 1).FirstOrDefault();
                                                        exchangeRate = getExchangeRate != null ? getExchangeRate.Price : 0;
                                                    }
                                                    
                                                    if (exchangeRate > 0)
                                                    {
                                                        WalletTransaction.ExchangeRate = exchangeRate;
                                                        Logger.LogWarning("StopTransaction => Đã cập nhật ExchangeRate = {0} cho TransactionId: {1}", exchangeRate, transaction.TransactionId);
                                                    }
                                                    else
                                                    {
                                                        Logger.LogError("StopTransaction => Không thể lấy giá điện. TransactionId: {0}", transaction.TransactionId);
                                                        // Đặt Amount = 0 nếu không có giá
                                                        WalletTransaction.Amount = 0;
                                                        WalletTransaction.newBalance = WalletTransaction.currentBalance;
                                                        dbContext.SaveChanges();
                                                        // Bỏ qua phần tính toán tiếp theo, chuyển sang xử lý UserApp
                                                        goto SkipAmountCalculation;
                                                    }
                                                }
                                                
                                                // Tính tiền dựa trên meterValue và ExchangeRate
                                                // valueControl: cap kWh theo upperLimit; sau đó cap Amount/newBalance để không âm tiền
                                                if (transaction.MeterStop.HasValue)
                                                {
                                                    logStopTransaction.Descriptions += "| pre6 (" + transaction.MeterStop.Value + ") | ";

                                                    if (!transaction.MeterStart.HasValue)
                                                    {
                                                        Logger.LogError("StopTransaction => MeterStart null cho TransactionId={0}, không thể tính meterValue.", transaction.TransactionId);
                                                        WalletTransaction.meterValue = 0;
                                                        WalletTransaction.Amount = 0;
                                                    }
                                                    else
                                                    {
                                                        // Tính đúng theo số điện đã sạc (không cap theo upperLimit)
                                                        WalletTransaction.meterValue = (decimal)(transaction.MeterStop.Value - transaction.MeterStart.Value);
                                                        WalletTransaction.stopMethod = "Normal";

                                                        decimal effectiveMeterKwh = WalletTransaction.meterValue;
                                                        if (WalletTransaction.chargeType == "valueControl"
                                                            && WalletTransaction.upperLimit.HasValue
                                                            && WalletTransaction.upperLimit.Value > 0
                                                            && effectiveMeterKwh > WalletTransaction.upperLimit.Value)
                                                        {
                                                            // Chỉ log cảnh báo khi vượt upperLimit, không thay đổi số kWh tính tiền
                                                            Logger.LogWarning("StopTransaction => meterValue={0} vượt upperLimit={1}, vẫn tính theo meterValue đầy đủ. TransactionId={2}", WalletTransaction.meterValue, WalletTransaction.upperLimit.Value, transaction.TransactionId);
                                                        }

                                                        WalletTransaction.Amount = effectiveMeterKwh * WalletTransaction.ExchangeRate.Value;
                                                        WalletTransaction.newBalance = WalletTransaction.currentBalance - WalletTransaction.Amount;
                                                    }
                                                }
                                                else
                                                {
                                                    // Nếu transaction.MeterStop vẫn null, thử lấy từ ConnectorStatus
                                                    logStopTransaction.Descriptions += "|  pre6 (null) transaction.MeterStop, thử lấy từ ConnectorStatus | ";
                                                    
                                                    var getConnectorStatus = dbContext.ConnectorStatuses
                                                        .Where(m => m.ChargePointId == transaction.ChargePointId && m.ConnectorId == transaction.ConnectorId)
                                                        .FirstOrDefault();
                                                    
                                                    if (getConnectorStatus != null && getConnectorStatus.LastMeterRemote != null)
                                                    {
                                                        try
                                                        {
                                                            var meterStopFromConnector = double.Parse(getConnectorStatus.LastMeterRemote.Split('|')[0]);
                                                            transaction.MeterStop = meterStopFromConnector;
                                                            dbContext.SaveChanges();
                                                            
                                                            if (!transaction.MeterStart.HasValue)
                                                            {
                                                                Logger.LogError("StopTransaction => MeterStart null khi lấy MeterStop từ ConnectorStatus. TransactionId={0}", transaction.TransactionId);
                                                                WalletTransaction.meterValue = 0;
                                                                WalletTransaction.Amount = 0;
                                                            }
                                                            else
                                                            {
                                                                // Tính đúng theo số điện đã sạc (không cap theo upperLimit)
                                                                WalletTransaction.meterValue = (decimal)(meterStopFromConnector - transaction.MeterStart.Value);
                                                                WalletTransaction.stopMethod = "Normal [456]";

                                                                decimal effectiveMeterKwhConn = WalletTransaction.meterValue;
                                                                if (WalletTransaction.chargeType == "valueControl"
                                                                    && WalletTransaction.upperLimit.HasValue
                                                                    && WalletTransaction.upperLimit.Value > 0
                                                                    && effectiveMeterKwhConn > WalletTransaction.upperLimit.Value)
                                                                {
                                                                    // Chỉ log cảnh báo khi vượt upperLimit, không thay đổi số kWh tính tiền
                                                                    Logger.LogWarning("StopTransaction => meterValue={0} vượt upperLimit={1} (ConnectorStatus), vẫn tính theo meterValue đầy đủ. TransactionId={2}", WalletTransaction.meterValue, WalletTransaction.upperLimit.Value, transaction.TransactionId);
                                                                }

                                                                WalletTransaction.Amount = effectiveMeterKwhConn * WalletTransaction.ExchangeRate.Value;
                                                                WalletTransaction.newBalance = WalletTransaction.currentBalance - WalletTransaction.Amount;
                                                            }
                                                            
                                                            Logger.LogInformation("StopTransaction => Đã lấy MeterStop={0} từ ConnectorStatus cho TransactionId={1}", meterStopFromConnector, transaction.TransactionId);
                                                        }
                                                        catch (Exception ex)
                                                        {
                                                            Logger.LogError(ex, "StopTransaction => Lỗi khi parse MeterStop từ ConnectorStatus. TransactionId={0}", transaction.TransactionId);
                                                            // Nếu không lấy được, đặt meterValue = 0 và không set newBalance để có thể tính lại sau
                                                            WalletTransaction.meterValue = 0;
                                                            WalletTransaction.Amount = 0;
                                                        }
                                                    }
                                                    else
                                                    {
                                                        Logger.LogWarning("StopTransaction => Không thể lấy MeterStop từ ConnectorStatus. TransactionId={0}, đặt meterValue=0", transaction.TransactionId);
                                                        WalletTransaction.meterValue = 0;
                                                        WalletTransaction.Amount = 0;
                                                        // Không set newBalance ở đây để có thể xử lý bổ sung sau nếu có đủ dữ liệu
                                                    }
                                                }
                                            }
                                            SkipAmountCalculation:
                                            WalletTransaction WalletTransactionForBalance = dbContext.WalletTransactions.Where(m => m.TransactionId == transaction.TransactionId).FirstOrDefault();
                                            if (WalletTransactionForBalance != null && WalletTransactionForBalance.newBalance.HasValue)
                                            {
                                                // Ghi trực tiếp newBalance vào UserApp.Balance, giữ nguyên số âm nếu có
                                                UserApp us = dbContext.UserApps.Where(m => m.Id == transaction.StartTagId).FirstOrDefault();
                                                if (us != null)
                                                {
                                                    us.Balance = WalletTransactionForBalance.newBalance.Value;
                                                    dbContext.SaveChanges();
                                                }
                                            }

                                            //Delete virtual
                                            TransactionVirtual tv = dbContext.TransactionVirtuals.Where(m => m.TransactionId == transaction.TransactionId).FirstOrDefault();
                                            if (tv != null)
                                            {
                                                dbContext.Remove(tv);
                                                dbContext.SaveChanges();
                                            }
                                            // ===== CHỨC NĂNG QR CODE (VNPay) ĐÃ BỊ VÔ HIỆU HÓA =====
                                            //delete tag virtual
                                            /*
                                            ChargeTag QrChargeTag = dbContext.ChargeTags.Where(m => m.TagId == transaction.StartTagId && m.TagType == "QR_Payment").FirstOrDefault();

                                            if (QrChargeTag != null)
                                            {
                                                dbContext.ChargeTags.Remove(QrChargeTag);
                                                dbContext.SaveChanges();
                                                //Update QRTransaction
                                                QRTransaction QRTransaction = dbContext.QRTransactions.Where(m => m.TransactionId == transaction.TransactionId).FirstOrDefault();
                                                if (QRTransaction != null)
                                                {
                                                    QRTransaction.EndTime = transaction.StopTime.Value;
                                                    QRTransaction.EnergyUsed = decimal.Parse((transaction.MeterStop.Value - transaction.MeterStart).ToString());
                                                    QRTransaction.StopMethod = transaction.StopReason;
                                                    dbContext.SaveChanges();
                                                }
                                            }
                                            //Delete virtal
                                            TransactionVirtualQR tvqr = dbContext.TransactionVirtualQRs.Where(m => m.TransactionId == transaction.TransactionId).FirstOrDefault();
                                            if (tvqr != null)
                                            {
                                                dbContext.Remove(tvqr);
                                                dbContext.SaveChanges();
                                            }
                                            */

                                            logStopTransaction.Descriptions += "| State 6" + " | ";
                                            dbContextlog.SaveChanges();
                                        }
                                        catch (Exception ex)
                                        {
                                            ResponseLog ResponseLog = new ResponseLog();
                                            ResponseLog.CreateDate = DateTime.Now;
                                            ResponseLog.isType = "Check lỗi remote stop {Cập nhật wallet}" + transaction.TransactionId;
                                            ResponseLog.isResponse = ex.Message;
                                            ResponseLog.isResponse += " | " + ex.StackTrace;
                                            dbContext.ResponseLogs.Add(ResponseLog);
                                            dbContext.SaveChanges();

                                            logStopTransaction.Descriptions += "| State 6 " + "wallet error (Nullable object must have a value.) | ";
                                            dbContextlog.SaveChanges();
                                        }
                                    }
                                    else
                                    {
                                        logStopTransaction.Descriptions += "| State 6 " + "stopTransactionRequest is NULL" + "" + " | ";
                                        dbContextlog.SaveChanges();
                                        errorCode = ErrorCodes.PropertyConstraintViolation;
                                    }
                                }
                                else 
                                {
                                    Logger.LogError("StopTransaction => Unknown transaction: id={0} / chargepoint={1} / tag={2}", stopTransactionRequest.TransactionId, ChargePointStatus?.Id, idTag);
                                    WriteMessageLog(ChargePointStatus?.Id, transaction?.ConnectorId, msgIn.Action, string.Format("UnknownTransaction:ID={0}/Meter={1}", stopTransactionRequest.TransactionId, stopTransactionRequest.MeterStop), errorCode);
                                    errorCode = ErrorCodes.PropertyConstraintViolation;
                                }
                            }
                        }
                    }
                    catch (Exception exp)
                    {
                        Logger.LogError(exp, "StopTransaction => Exception writing transaction: chargepoint={0} / tag={1} / reason={2}", ChargePointStatus?.Id, idTag, exp.Message);
                        errorCode = ErrorCodes.InternalError;
                        LogStopTransaction ls = new LogStopTransaction();
                        ls.Descriptions = exp.Message;
                        ls.Timestart = DateTime.Now;
                        ls.Timestop = DateTime.Now;
                        ls.TransactionId = stopTransactionRequest.TransactionId;
                        ls.StopTransactionResponse = "Internal error";
                        dbContextlog.LogStopTransactions.Add(ls);
                        dbContextlog.SaveChanges();
                        
                    }
                }

                msgOut.JsonPayload = JsonConvert.SerializeObject(stopTransactionResponse);
               
                Logger.LogTrace("StopTransaction => Response serialized");
                using (OCPPCoreContext dbContext = new OCPPCoreContext(Configuration))
                {
                    if (logStopTransaction != null)
                        logStopTransaction.Descriptions += "| State 7 " + "StopTransaction errorCode: " + errorCode + " " + "" + " | ";
                    dbContextlog.SaveChanges();
                }
            }
            catch (Exception exp)
            {
                Logger.LogError(exp, "StopTransaction => Exception: {0}", exp.Message);
                errorCode = exp.Message;
                if (logStopTransaction != null)
                    logStopTransaction.Descriptions += "| State 8 " + "StopTransaction error: " + "" +exp.Message+ " | ";

            }

            WriteMessageLog(ChargePointStatus?.Id, null, msgIn.Action, stopTransactionResponse.IdTagInfo?.Status.ToString(), errorCode);
            LogOCPP("Finished");
            using (OCPPCoreContext dbContextlog = new OCPPCoreContext(Configuration))
            {
                if (logStopTransaction != null)
                    logStopTransaction.Descriptions += "| State 9 " + "Finished errorCode is " + errorCode + " " + "" + " | ";
                dbContextlog.SaveChanges();
            }


            return errorCode;
        }


        public async  Task  SendMeter(string apiUrl)
        {
            HttpClient _httpClient = new HttpClient();
            HttpResponseMessage response =await _httpClient.GetAsync(apiUrl);
        }
        public async Task SendMessage(string userTo,string body)
        {
            string serverKey = "AAAAvXGNK6E:APA91bG7sMWvF2POHTv4RbGIbkH9fA0v_lDvS2GTTvMD5lJamx7mLR_Df6rPusr9JHD4J3ZSxiKQyfCIG9uqcXX2lDPbO0c7CK_zUnrfu_UTg69jHe_ruaVeQIL448HDTF1dLIo0JRFw";
            string fcmUrl = "https://fcm.googleapis.com/fcm/send";

            var jsonMessage = @"{
           ""to"": """ + userTo + @""",
            ""notification"": {
                ""title"": ""Sạc thành công"",
                ""body"": """+body+@""",
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