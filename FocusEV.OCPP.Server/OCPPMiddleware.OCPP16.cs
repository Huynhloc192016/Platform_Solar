using FocusEV.OCPP.Database;
using FocusEV.OCPP.Server.Messages_OCPP16;
using FocusEV.OCPP.Server.Messages_OCPP20;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.WebSockets;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;

namespace FocusEV.OCPP.Server
{
    public partial class OCPPMiddleware 
    {
        public IConfiguration Configuration { get; set; }
        /// <summary>
        /// Waits for new OCPP V1.6 messages on the open websocket connection and delegates processing to a controller
        /// </summary>
        /// 

        public class ChargingSchedulePeriod
        {
            public int startPeriod { get; set; }
            public int limit { get; set; }
        }

        public class ChargingSchedule
        {
            public int duration { get; set; }
            public DateTime startSchedule { get; set; }
            public string chargingRateUnit { get; set; }
            public ChargingSchedulePeriod[] chargingSchedulePeriod { get; set; }
        }

        public class ChargingProfile
        {
            public int chargingProfileId { get; set; }
            public int stackLevel { get; set; }
            public string chargingProfilePurpose { get; set; }
            public string chargingProfileKind { get; set; }
            public ChargingSchedule chargingSchedule { get; set; }
        }

        public class RemoteStartTransactionRequest
        {
            public string messageTypeId { get; set; }
            public int connectorId { get; set; }
            public string idTag { get; set; }
            public ChargingProfile chargingProfile { get; set; }
        }
        private async Task TriggerAppMessage(WebSocket webSocket, string message)
        {
            ILogger logger = _logFactory.CreateLogger("OCPPMiddleware.OCPP16");


            byte[] buffer = new byte[1024 * 4];
            MemoryStream memStream = new MemoryStream(buffer.Length);
            while (webSocket.State == WebSocketState.Open)
            {
                WebSocketReceiveResult result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                if (result != null && result.MessageType != WebSocketMessageType.Close)
                {
                    logger.LogTrace("OCPPMiddleware.Receive16 => Receiving segment: {0} bytes (EndOfMessage={1} / MsgType={2})", result.Count, result.EndOfMessage, result.MessageType);
                    memStream.Write(buffer, 0, result.Count);

                    if (result.EndOfMessage)
                    {
                        // logger.LogTrace("My log Messsage: "+ result.EndOfMessage)
                        // read complete message into byte array
                        byte[] bMessage = memStream.ToArray();
                        // reset memory stream für next message
                        memStream = new MemoryStream(buffer.Length);

                       
                        string ocppMessage = UTF8Encoding.UTF8.GetString(bMessage);
                        await SendOcpp16AppMessage(null, logger, webSocket);

                    }  
                }
                else
                {
                    logger.LogInformation("OCPPMiddleware.Receive16 => WebSocket Closed: CloseStatus={0} / MessageType={1}", result?.CloseStatus, result?.MessageType);
                    await webSocket.CloseOutputAsync((WebSocketCloseStatus)3001, string.Empty, CancellationToken.None);
                }
            }
        }

        private async Task SendOcpp16AppMessage(OCPPMessage msg, ILogger logger, WebSocket webSocket)
        {
            string ocppTextMessage = "{\"message\":10}"; ;


            byte[] binaryMessage = UTF8Encoding.UTF8.GetBytes(ocppTextMessage);
            await webSocket.SendAsync(new ArraySegment<byte>(binaryMessage, 0, binaryMessage.Length), WebSocketMessageType.Text, true, CancellationToken.None);
        }

        private async Task SendOcppTriggerApp(OCPPMessage msg, ILogger logger, WebSocket webSocket, string messageTrigger)
        {
            string ocppTextMessage = null;

            if (string.IsNullOrEmpty(msg.ErrorCode))
            {
                msg.JsonPayload = "{\"requestedMessage\":\"" + messageTrigger + "\",\"connectorId\":1}";
                msg.UniqueId = Guid.NewGuid().ToString();

                ocppTextMessage = string.Format("[{0},\"{1}\",\"{2}\",{3}]", 2, msg.UniqueId, "TriggerMessage", msg.JsonPayload);
            }
            byte[] binaryMessage = UTF8Encoding.UTF8.GetBytes(ocppTextMessage);
            await webSocket.SendAsync(new ArraySegment<byte>(binaryMessage, 0, binaryMessage.Length), WebSocketMessageType.Text, true, CancellationToken.None);
        }
        private async Task TriggerMessage(WebSocket webSocket,string messageTrigger,int conectorID)
        { 
            while (webSocket.State == WebSocketState.Open)
            {
                OCPPMessage msgOut = new OCPPMessage();

                // Send OCPP message with optional logging/dump
                await SendOcppTrigger(msgOut, null, webSocket, messageTrigger, conectorID); 
                return;
            }
        }
        private async Task StopTriggerMessage(WebSocket webSocket, int conectorID)
        {
            while (webSocket.State == WebSocketState.Open)
            {
                OCPPMessage msgOut = new OCPPMessage();

                // Send OCPP message with optional logging/dump
                await SendOcppStopTrigger(msgOut, null, webSocket, conectorID);
                return;
            }
        }
        private async Task ChargingSchedules(WebSocket webSocket, int conectorID, decimal upperLimit,int transactionid,IConfiguration configuration)
        {
            while (webSocket.State == WebSocketState.Open)
            {
                OCPPMessage msgOut = new OCPPMessage();

                // Send OCPP message with optional logging/dump
                await SendOcppChargingSchedule(msgOut, null, webSocket, upperLimit, transactionid, conectorID, configuration);
                return;
            }
        }
        /// <summary>
        /// Gửi SetChargingProfile (OCPP 1.6) cho trụ Juhang - TxProfile với limit theo upperLimit (kWh).
        /// Trụ Juhang hỗ trợ SetChargingProfile, dùng để giới hạn phiên sạc tránh âm ví.
        /// </summary>
        private async Task SetChargingProfileToDevice(WebSocket webSocket, int connectorId, decimal upperLimitKwh, int transactionId, IConfiguration configuration)
        {
            if (webSocket.State != WebSocketState.Open) return;
            OCPPMessage msgOut = new OCPPMessage();
            await SendOcppSetChargingProfile(msgOut, null, webSocket, connectorId, upperLimitKwh, transactionId, configuration);
        }
        private async Task SendOcppSetChargingProfile(OCPPMessage msg, ILogger logger, WebSocket webSocket, int connectorId, decimal upperLimitKwh, int transactionId, IConfiguration configuration)
        {
            string ocppTextMessage = null;
            if (string.IsNullOrEmpty(msg?.ErrorCode))
            {
                msg = msg ?? new OCPPMessage();
                msg.UniqueId = Guid.NewGuid().ToString();
                // OCPP 1.6 SetChargingProfile: limit theo W (chargingRateUnit "W"). Gửi upperLimit kWh * 1000 = Wh để trụ có thể hiểu là giới hạn năng lượng (nếu hỗ trợ) hoặc công suất tối đa (W).
                int limitValue = (int)Math.Round(upperLimitKwh * 1000m);
                if (limitValue <= 0) limitValue = 1;
                var payload = new
                {
                    connectorId = connectorId,
                    csChargingProfiles = new
                    {
                        chargingProfileId = transactionId,
                        stackLevel = 1,
                        chargingProfilePurpose = "TxProfile",
                        chargingProfileKind = "Absolute",
                        transactionId = transactionId,
                        chargingSchedule = new
                        {
                            duration = 86400,
                            startSchedule = DateTime.UtcNow.ToString("o"),
                            chargingRateUnit = "W",
                            chargingSchedulePeriod = new[]
                            {
                                new { startPeriod = 0, limit = limitValue }
                            }
                        }
                    }
                };
                string jsonPayload = JsonConvert.SerializeObject(payload);
                ocppTextMessage = string.Format("[{0},\"{1}\",\"{2}\",{3}]", 2, msg.UniqueId, "SetChargingProfile", jsonPayload);
            }
            if (string.IsNullOrEmpty(ocppTextMessage)) return;
            byte[] binaryMessage = UTF8Encoding.UTF8.GetBytes(ocppTextMessage);
            await webSocket.SendAsync(new ArraySegment<byte>(binaryMessage, 0, binaryMessage.Length), WebSocketMessageType.Text, true, CancellationToken.None);
        }
        private async Task SendOcppChargingSchedule(OCPPMessage msg, ILogger logger, WebSocket webSocket,decimal upperLimit, int transactionid, int conectorID,IConfiguration configuration)
        {
            string ocppTextMessage = null;

            if (string.IsNullOrEmpty(msg.ErrorCode))
            {
                msg.JsonPayload = "{\"type\":\"" + "Energy" + "\",\"unit\":\"" + "kWh" + "\",\"upperLimit\":" + upperLimit + ",\"transactionId\":" + transactionid + "}";
                msg.UniqueId = Guid.NewGuid().ToString(); 
               
                FocusEV.OCPP.Server.Messages_OCPP16.DataTransferRequest dtrq = new FocusEV.OCPP.Server.Messages_OCPP16.DataTransferRequest();
                dtrq.Data = msg.JsonPayload;
                dtrq.MessageId = "ChargingSchedule";
                dtrq.VendorId = "rus.avt.cp"; 
                var value= "{\"vendorId\":\"" + dtrq.VendorId + "\",\"messageId\":\"" + dtrq.MessageId + "\",\"data\":" + dtrq.Data + "}";
                ocppTextMessage = string.Format("[{0},\"{1}\",\"{2}\",{3}]", 2, msg.UniqueId, "DataTransfer", value);
                using (OCPPCoreContext dbContext = new OCPPCoreContext(_configuration))
                {
                    try
                    {
                        ResponseLog ResponseLog = new ResponseLog();
                        ResponseLog.isResponse = ocppTextMessage;
                        ResponseLog.CreateDate = DateTime.Now;
                        ResponseLog.isType = "Data tranfer";
                        dbContext.ResponseLogs.Add(ResponseLog);
                        dbContext.SaveChanges();
                    }
                    catch(Exception ex)
                    {

                    }
                   //
                    var findwallet = dbContext.WalletTransactions.Where(m => m.TransactionId == transactionid).FirstOrDefault();
                    if (findwallet != null)
                    {
                        findwallet.DataTransferQuery = ocppTextMessage;
                        dbContext.SaveChanges();
                    }
                    // ===== CHỨC NĂNG QR CODE (VNPay) ĐÃ BỊ VÔ HIỆU HÓA =====
                    /*
                    var findQrtransaction = dbContext.QRTransactions.Where(m => m.TransactionId == transactionid).FirstOrDefault();
                    if (findQrtransaction != null)
                    {
                        findQrtransaction.DataTransferQuery= ocppTextMessage;
                        dbContext.SaveChanges();
                    }
                    */
                }

               
            }
            byte[] binaryMessage = UTF8Encoding.UTF8.GetBytes(ocppTextMessage);
            await webSocket.SendAsync(new ArraySegment<byte>(binaryMessage, 0, binaryMessage.Length), WebSocketMessageType.Text, true, CancellationToken.None);
        }
        private async Task SendOcppStopTrigger(OCPPMessage msg, ILogger logger, WebSocket webSocket,  int conectorID)
        {
            string ocppTextMessage = null;

            if (string.IsNullOrEmpty(msg.ErrorCode))
            {
                msg.JsonPayload = "{}";
                msg.UniqueId = Guid.NewGuid().ToString();
                ocppTextMessage = string.Format("[{0},\"{1}\",{2}]",3, msg.UniqueId,msg.JsonPayload);
            }
            byte[] binaryMessage = UTF8Encoding.UTF8.GetBytes(ocppTextMessage);
            await webSocket.SendAsync(new ArraySegment<byte>(binaryMessage, 0, binaryMessage.Length), WebSocketMessageType.Text, true, CancellationToken.None);
        }
        private async Task SendOcppTrigger(OCPPMessage msg, ILogger logger, WebSocket webSocket, string messageTrigger,int conectorID)
        {
            string ocppTextMessage = null;

            if (string.IsNullOrEmpty(msg.ErrorCode))
            {
                msg.JsonPayload = "{\"requestedMessage\":\"" + messageTrigger + "\",\"connectorId\":"+conectorID+"}";
                msg.UniqueId = Guid.NewGuid().ToString();

                ocppTextMessage = string.Format("[{0},\"{1}\",\"{2}\",{3}]", 2, msg.UniqueId, "TriggerMessage", msg.JsonPayload);
            }
            byte[] binaryMessage = UTF8Encoding.UTF8.GetBytes(ocppTextMessage);
            await webSocket.SendAsync(new ArraySegment<byte>(binaryMessage, 0, binaryMessage.Length), WebSocketMessageType.Text, true, CancellationToken.None);
        }
        private async Task GetResponseStop(WebSocket webSocket)
        {
            while (webSocket.State == WebSocketState.Open)
            {
                OCPPMessage msgOut = new OCPPMessage();

                // Send OCPP message with optional logging/dump
                await SendOcppGetResponseStop(msgOut, null, webSocket);
                return;
            }
        }
        private async Task SendOcppGetResponseStop(OCPPMessage msg, ILogger logger, WebSocket webSocket)
        {
            string ocppTextMessage = null;

            if (string.IsNullOrEmpty(msg.ErrorCode))
            {
                StopTransactionResponse stopTransactionResponse = new StopTransactionResponse();
                stopTransactionResponse.IdTagInfo = new IdTagInfo();
                stopTransactionResponse.IdTagInfo.ExpiryDate= new DateTime(2199, 12, 31);
                stopTransactionResponse.IdTagInfo.Status = IdTagInfoStatus.Accepted;
                msg.JsonPayload = JsonConvert.SerializeObject(stopTransactionResponse); 
                msg.UniqueId = Guid.NewGuid().ToString();

                ocppTextMessage = string.Format("[{0},\"{1}\",{2}]",3, msg.UniqueId, msg.JsonPayload);
              //  ocppTextMessage = string.Format("[{0},\"{1}\",\"{2}\",{3}]", 2, msg.UniqueId, "GetCompositeSchedule", msg.JsonPayload);
            }
            byte[] binaryMessage = UTF8Encoding.UTF8.GetBytes(ocppTextMessage);
            await webSocket.SendAsync(new ArraySegment<byte>(binaryMessage, 0, binaryMessage.Length), WebSocketMessageType.Text, true, CancellationToken.None);
        }


        private async Task RemoteStartransaction(WebSocket webSocket,string TagId,int ConnectorId)
        {
            while (webSocket.State == WebSocketState.Open)
            {
                OCPPMessage msgOut = new OCPPMessage();

                // Send OCPP message with optional logging/dump
                await SendOcppRemoteStartransaction(msgOut, null, webSocket, TagId, ConnectorId);
                return;
            }
        }
        // ===== CHỨC NĂNG QR CODE (VNPay) ĐÃ BỊ VÔ HIỆU HÓA =====
        /*
        private async Task RemoteStartransactionQR(WebSocket webSocket, string TagId, int ConnectorId)
        {
            while (webSocket.State == WebSocketState.Open)
            {
                OCPPMessage msgOut = new OCPPMessage();

                // Send OCPP message with optional logging/dump
                await SendOcppRemoteStartransaction(msgOut, null, webSocket, TagId, ConnectorId);
                return;
            }
        }
        */
        private async Task RemoteStopransaction(WebSocket webSocket,int TransactionId)
        {
            while (webSocket.State == WebSocketState.Open)
            {
                OCPPMessage msgOut = new OCPPMessage();

                // Send OCPP message with optional logging/dump
                await SendOcppRemoteStopTransaction(msgOut, null, webSocket, TransactionId);
                return;
            }
        }
        private async Task SendOcppRemoteStopTransaction(OCPPMessage msg, ILogger logger, WebSocket webSocket,int TransactionId)
        {
            string ocppTextMessage = null;

            if (string.IsNullOrEmpty(msg.ErrorCode))
            {
                msg.JsonPayload = "{\"messageTypeId \":\"" + "RemoteStopTransaction" + "\",\"transactionId\":\"" + TransactionId + "\"}";
                msg.UniqueId = Guid.NewGuid().ToString();

                ocppTextMessage = string.Format("[{0},\"{1}\",\"{2}\",{3}]", 2, msg.UniqueId, "RemoteStopTransaction", msg.JsonPayload);
            }
            byte[] binaryMessage = UTF8Encoding.UTF8.GetBytes(ocppTextMessage);
            await webSocket.SendAsync(new ArraySegment<byte>(binaryMessage, 0, binaryMessage.Length), WebSocketMessageType.Text, true, CancellationToken.None);
        }
        private async Task SendOcppRemoteStartransaction(OCPPMessage msg, ILogger logger, WebSocket webSocket,string TagId,int ConnectorId)
        {
            string ocppTextMessage = null;

            if (string.IsNullOrEmpty(msg.ErrorCode))
            {
                RemoteStartTransactionRequest request = new RemoteStartTransactionRequest
                {
                    messageTypeId = "RemoteStartTransaction",
                    connectorId = ConnectorId,
                    idTag = TagId,
                    chargingProfile = new ChargingProfile
                    {
                        chargingProfileId = 1,
                        stackLevel = 1,
                        chargingProfilePurpose = "TxProfile",
                        chargingProfileKind = "Absolute",
                        chargingSchedule = new ChargingSchedule
                        {
                            duration = 0,
                            startSchedule = DateTime.Parse("2023-11-21T09:00:00Z"),
                            chargingRateUnit = "A",
                            chargingSchedulePeriod = new ChargingSchedulePeriod[]
                     {
                        new ChargingSchedulePeriod
                        {
                            startPeriod = 0,
                            limit =32
                        }
                     }
                        }
                    }
                };

               
                string jsonString = JsonConvert.SerializeObject(request, Formatting.Indented);
                msg.JsonPayload = jsonString;
                msg.UniqueId = Guid.NewGuid().ToString();
                //Ghi log transaction
                try
                {
                    using (OCPPCoreContext dbContext = new OCPPCoreContext(_configuration))
                    {
                        TransactionLogs tranlog = new TransactionLogs();
                        tranlog.ChargePointId = TagId;
                        tranlog.ConnectorId = ConnectorId;
                        tranlog.ServerRemoteStartTime = DateTime.Now;
                        tranlog.ServerRemoteStartJson = jsonString;
                        //
                        tranlog.ServerStartConfTime  = DateTime.Now;
                        tranlog.ClientStartTime = DateTime.Now;
                        tranlog.ClientStopTime = DateTime.Now;
                        tranlog.ServerStartConfTime= DateTime.Now;
                        tranlog.ServerStopConfTime = DateTime.Now;
                        dbContext.TransactionLogs.Add(tranlog); 
                        dbContext.SaveChanges();
                    }
                }
                catch (Exception ex)
                {

                }
                ocppTextMessage = string.Format("[{0},\"{1}\",\"{2}\",{3}]", 2, msg.UniqueId, "RemoteStartTransaction", msg.JsonPayload);
            }
            byte[] binaryMessage = UTF8Encoding.UTF8.GetBytes(ocppTextMessage);
            await webSocket.SendAsync(new ArraySegment<byte>(binaryMessage, 0, binaryMessage.Length), WebSocketMessageType.Text, true, CancellationToken.None);
        }

       


        private async Task Remote16(WebSocket webSocket)
        {
            ChargePointStatus chargePointStatus=new ChargePointStatus();
            ControllerOCPP16 controller16 = new ControllerOCPP16(_configuration, _logFactory, chargePointStatus);
            ILogger logger = _logFactory.CreateLogger("OCPPMiddleware.OCPP16");
            byte[] buffer = new byte[1024 * 4];
            MemoryStream memStream = new MemoryStream(buffer.Length);
            while (webSocket.State == WebSocketState.Open)
            {

                OCPPMessage msgOut =new OCPPMessage();

                // Send OCPP message with optional logging/dump
                await SendOcpp16Remote(msgOut, logger, webSocket);
                int a = 10;
                return;
            }
            //string ocppTextMessage = null;
            //byte[] binaryMessage = UTF8Encoding.UTF8.GetBytes(ocppTextMessage);
            //await webSocket.SendAsync(new ArraySegment<byte>(binaryMessage, 0, binaryMessage.Length), WebSocketMessageType.Text, true, CancellationToken.None);
        }
        private async Task Receive16(ChargePointStatus chargePointStatus, HttpContext context)
        {
            ILogger logger = _logFactory.CreateLogger("OCPPMiddleware.OCPP16");

            ControllerOCPP16 controller16 = new ControllerOCPP16(_configuration, _logFactory, chargePointStatus);

            byte[] buffer = new byte[1024 * 4];
            MemoryStream memStream = new MemoryStream(buffer.Length);

            while (chargePointStatus.WebSocket.State == WebSocketState.Open)
            {
                WebSocketReceiveResult result = await chargePointStatus.WebSocket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                if (result != null && result.MessageType != WebSocketMessageType.Close)
                {
                    logger.LogTrace("OCPPMiddleware.Receive16 => Receiving segment: {0} bytes (EndOfMessage={1} / MsgType={2})", result.Count, result.EndOfMessage, result.MessageType);
                    memStream.Write(buffer, 0, result.Count);

                    if (result.EndOfMessage)
                    {
                       // logger.LogTrace("My log Messsage: "+ result.EndOfMessage)
                        // read complete message into byte array
                        byte[] bMessage = memStream.ToArray();
                        // reset memory stream für next message
                        memStream = new MemoryStream(buffer.Length);

                        string dumpDir = _configuration.GetValue<string>("MessageDumpDir");
                        if (!string.IsNullOrWhiteSpace(dumpDir))
                        {
                            string path = Path.Combine(dumpDir, string.Format("{0}_ocpp16-in.txt", DateTime.Now.ToString("yyyy-MM-dd_HH-mm-ss-ffff")));
                            try
                            {
                                // Write incoming message into dump directory
                                File.WriteAllBytes(path, bMessage);
                            }
                            catch (Exception exp)
                            {
                                logger.LogError(exp, "OCPPMiddleware.Receive16 => Error dumping incoming message to path: '{0}'", path);
                            }
                        }

                        string ocppMessage = UTF8Encoding.UTF8.GetString(bMessage);

                        Match match = Regex.Match(ocppMessage, MessageRegExp);
                        if (match != null && match.Groups != null && match.Groups.Count >= 3)
                        {
                            string messageTypeId = match.Groups[1].Value;
                            string uniqueId = match.Groups[2].Value;
                            string action = match.Groups[3].Value;
                            string jsonPaylod = match.Groups[4].Value;
                            logger.LogInformation("OCPPMiddleware.Receive16 => OCPP-Message: Type={0} / ID={1} / Action={2})", messageTypeId, uniqueId, action);

                            OCPPMessage msgIn = new OCPPMessage(messageTypeId, uniqueId, action, jsonPaylod);
                            if (msgIn.Action != "Heartbeat")
                                logger.LogTrace("My log" + msgIn.Action);
                            if (msgIn.MessageType == "2")
                            {
                                // Request from chargepoint to OCPP server
                                OCPPMessage msgOut = controller16.ProcessRequest(msgIn);
                                 
                                // Send OCPP message with optional logging/dump
                                await SendOcpp16Message(msgOut, logger, chargePointStatus.WebSocket);
                            }
                            else if (msgIn.MessageType == "3" || msgIn.MessageType == "4")
                            {
                                // Process answer from chargepoint
                                if (_requestQueue.ContainsKey(msgIn.UniqueId))
                                {
                                    controller16.ProcessAnswer(msgIn, _requestQueue[msgIn.UniqueId]);
                                    _requestQueue.Remove(msgIn.UniqueId);
                                }
                                else
                                {
                                    logger.LogError("OCPPMiddleware.Receive16 => HttpContext from caller not found / Msg: {0}", ocppMessage);
                                }
                            }
                            else
                            {
                                // Unknown message type
                                logger.LogError("OCPPMiddleware.Receive16 => Unknown message type: {0} / Msg: {1}", msgIn.MessageType, ocppMessage);
                            }
                        }
                        else
                        {
                            logger.LogWarning("OCPPMiddleware.Receive16 => Error in RegEx-Matching: Msg={0})", ocppMessage);
                        }
                    }
                }
                else
                {
                    logger.LogInformation("OCPPMiddleware.Receive16 => WebSocket Closed: CloseStatus={0} / MessageType={1}", result?.CloseStatus, result?.MessageType);
                    await chargePointStatus.WebSocket.CloseOutputAsync((WebSocketCloseStatus)3001, string.Empty, CancellationToken.None);
                }
            }
            logger.LogInformation("OCPPMiddleware.Receive16 => Websocket closed: State={0} / CloseStatus={1}", chargePointStatus.WebSocket.State, chargePointStatus.WebSocket.CloseStatus);
            ChargePointStatus dummy;
            _chargePointStatusDict.Remove(chargePointStatus.Id, out dummy);
        }

        /// <summary>
        /// Waits for new OCPP V1.6 messages on the open websocket connection and delegates processing to a controller
        /// </summary>
        private async Task Reset16(ChargePointStatus chargePointStatus, HttpContext apiCallerContext)
        {
            ILogger logger = _logFactory.CreateLogger("OCPPMiddleware.OCPP16");
            ControllerOCPP16 controller16 = new ControllerOCPP16(_configuration, _logFactory, chargePointStatus);

            Messages_OCPP16.ResetRequest resetRequest = new Messages_OCPP16.ResetRequest();
            resetRequest.Type = Messages_OCPP16.ResetRequestType.Soft;
            string jsonResetRequest = JsonConvert.SerializeObject(resetRequest);

            OCPPMessage msgOut = new OCPPMessage();
            msgOut.MessageType = "2";
            msgOut.Action = "Reset";
            msgOut.UniqueId = Guid.NewGuid().ToString("N");
            msgOut.JsonPayload = jsonResetRequest;
            msgOut.TaskCompletionSource = new TaskCompletionSource<string>();

            // store HttpContext with MsgId for later answer processing (=> send anwer to API caller)
            _requestQueue.Add(msgOut.UniqueId, msgOut);

            // Send OCPP message with optional logging/dump
            await SendOcpp16Message(msgOut, logger, chargePointStatus.WebSocket);

            // Wait for asynchronous chargepoint response and processing
            string apiResult = await msgOut.TaskCompletionSource.Task;

            // 
            apiCallerContext.Response.StatusCode = 200;
            apiCallerContext.Response.ContentType = "application/json";
            await apiCallerContext.Response.WriteAsync(apiResult);
        }

        /// <summary>
        /// Sends a Unlock-Request to the chargepoint
        /// </summary>
        private async Task UnlockConnector16(ChargePointStatus chargePointStatus, HttpContext apiCallerContext)
        {
            ILogger logger = _logFactory.CreateLogger("OCPPMiddleware.OCPP16");
            ControllerOCPP16 controller16 = new ControllerOCPP16(_configuration, _logFactory, chargePointStatus);

            Messages_OCPP16.UnlockConnectorRequest unlockConnectorRequest = new Messages_OCPP16.UnlockConnectorRequest();
            unlockConnectorRequest.ConnectorId = 0;

            string jsonResetRequest = JsonConvert.SerializeObject(unlockConnectorRequest);

            OCPPMessage msgOut = new OCPPMessage();
            msgOut.MessageType = "2";
            msgOut.Action = "UnlockConnector";
            msgOut.UniqueId = Guid.NewGuid().ToString("N");
            msgOut.JsonPayload = jsonResetRequest;
            msgOut.TaskCompletionSource = new TaskCompletionSource<string>();

            // store HttpContext with MsgId for later answer processing (=> send anwer to API caller)
            _requestQueue.Add(msgOut.UniqueId, msgOut);

            // Send OCPP message with optional logging/dump
            await SendOcpp16Message(msgOut, logger, chargePointStatus.WebSocket);

            // Wait for asynchronous chargepoint response and processing
            string apiResult = await msgOut.TaskCompletionSource.Task;

            // 
            apiCallerContext.Response.StatusCode = 200;
            apiCallerContext.Response.ContentType = "application/json";
            await apiCallerContext.Response.WriteAsync(apiResult);
        }

        private async Task SendOcpp16Message(OCPPMessage msg, ILogger logger, WebSocket webSocket)
        {
            string ocppTextMessage = null;

            if (string.IsNullOrEmpty(msg.ErrorCode))
            {
                if (msg.MessageType == "2")
                {
                    // OCPP-Request
                    ocppTextMessage = string.Format("[{0},\"{1}\",\"{2}\",{3}]", msg.MessageType, msg.UniqueId, msg.Action, msg.JsonPayload);
                }
                else
                {
                    // OCPP-Response
                    ocppTextMessage = string.Format("[{0},\"{1}\",{2}]", msg.MessageType, msg.UniqueId, msg.JsonPayload);
                }
            }
            else
            {
                ocppTextMessage = string.Format("[{0},\"{1}\",\"{2}\",\"{3}\",{4}]", msg.MessageType, msg.UniqueId, msg.ErrorCode, msg.ErrorDescription, "{}");
            }
            logger.LogTrace("OCPPMiddleware.OCPP16 => SendOcppMessage: {0}", ocppTextMessage);

            if (string.IsNullOrEmpty(ocppTextMessage))
            {
                // invalid message
                ocppTextMessage = string.Format("[{0},\"{1}\",\"{2}\",\"{3}\",{4}]", "4", string.Empty, Messages_OCPP16.ErrorCodes.ProtocolError, string.Empty, "{}");
            }

            string dumpDir = _configuration.GetValue<string>("MessageDumpDir");
            if (!string.IsNullOrWhiteSpace(dumpDir))
            {
                // Write outgoing message into dump directory
                string path = Path.Combine(dumpDir, string.Format("{0}_ocpp16-out.txt", DateTime.Now.ToString("yyyy-MM-dd_HH-mm-ss-ffff")));
                try
                {
                    File.WriteAllText(path, ocppTextMessage);
                }
                catch (Exception exp)
                {
                    logger.LogError(exp, "OCPPMiddleware.SendOcpp16Message=> Error dumping message to path: '{0}'", path);
                }
            }

            byte[] binaryMessage = UTF8Encoding.UTF8.GetBytes(ocppTextMessage);
            await webSocket.SendAsync(new ArraySegment<byte>(binaryMessage, 0, binaryMessage.Length), WebSocketMessageType.Text, true, CancellationToken.None);
        }

        private async Task SendOcpp16Remote(OCPPMessage msg, ILogger logger, WebSocket webSocket)
        {
            string ocppTextMessage = null;

            if (string.IsNullOrEmpty(msg.ErrorCode))
            {
                if (msg.MessageType == "2")
                {
                    // OCPP-Request
                    ocppTextMessage = string.Format("[{0},\"{1}\",\"{2}\",{3}]", msg.MessageType, msg.UniqueId, msg.Action, msg.JsonPayload);
                }
                else
                {
                    // OCPP-Response
                    //ocppTextMessage = string.Format("[{0},\"{1}\",{2}]", msg.MessageType, msg.UniqueId, msg.JsonPayload);
                    msg.JsonPayload = "RemoteStartTransaction";
                    ocppTextMessage = string.Format("[{0},\"{1}\",\"{2}\"]", 2, msg.UniqueId, msg.JsonPayload);
                }
            }

            if (string.IsNullOrEmpty(ocppTextMessage))
            {
                // invalid message
                ocppTextMessage = string.Format("[{0},\"{1}\",\"{2}\",\"{3}\",{4}]", "4", string.Empty, Messages_OCPP16.ErrorCodes.ProtocolError, string.Empty, "{}");
            }

            string dumpDir = _configuration.GetValue<string>("MessageDumpDir");
            if (!string.IsNullOrWhiteSpace(dumpDir))
            {
                // Write outgoing message into dump directory
                string path = Path.Combine(dumpDir, string.Format("{0}_ocpp16-out.txt", DateTime.Now.ToString("yyyy-MM-dd_HH-mm-ss-ffff")));
                try
                {
                    File.WriteAllText(path, ocppTextMessage);
                }
                catch (Exception exp)
                {
                    logger.LogError(exp, "OCPPMiddleware.SendOcpp16Message=> Error dumping message to path: '{0}'", path);
                }
            }

            byte[] binaryMessage = UTF8Encoding.UTF8.GetBytes(ocppTextMessage);
            await webSocket.SendAsync(new ArraySegment<byte>(binaryMessage, 0, binaryMessage.Length), WebSocketMessageType.Text, true, CancellationToken.None);
        }
    }
}
