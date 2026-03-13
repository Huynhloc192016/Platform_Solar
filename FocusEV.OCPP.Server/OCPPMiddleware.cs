using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using FocusEV.OCPP.Database;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.WebSockets;
using System.Security.Cryptography.X509Certificates;
using System.Threading.Tasks;
using WebSocketManager.Common;
using Microsoft.AspNetCore.SignalR.Protocol;

namespace FocusEV.OCPP.Server
{
    public partial class OCPPMiddleware
    {
        private const string Protocol_OCPP16 = "ocpp1.6";
        private const string Protocol_OCPP20 = "ocpp2.0";
        private static readonly string[] SupportedProtocols = { Protocol_OCPP20, Protocol_OCPP16 /*, "ocpp1.5" */};

        private static string MessageRegExp = "^\\[\\s*(\\d)\\s*,\\s*\"([^\"]*)\"\\s*,(?:\\s*\"(\\w*)\"\\s*,)?\\s*(.*)\\s*\\]$";

        private readonly RequestDelegate _next;
        private readonly ILoggerFactory _logFactory;
        private readonly ILogger _logger;
        private readonly IConfiguration _configuration;

        private static Dictionary<string, ChargePointStatus> _chargePointStatusDict = new Dictionary<string, ChargePointStatus>();

        private Dictionary<string, OCPPMessage> _requestQueue = new Dictionary<string, OCPPMessage>();

        static string GenerateRandomString(int length)
        {
            const string chars = "ABCDEF123456789";
            Random random = new Random();
            return new string(Enumerable.Repeat(chars, length)
                .Select(s => s[random.Next(s.Length)]).ToArray());
        }

        public OCPPMiddleware(RequestDelegate next, ILoggerFactory logFactory, IConfiguration configuration)
        {
            _next = next;
            _logFactory = logFactory;
            _configuration = configuration;

            _logger = logFactory.CreateLogger("OCPPMiddleware");
        }
        List<WebSocket> webSockets = new List<WebSocket>();
        public async Task Invoke(HttpContext context)        
        {
           
            string url = context.Request.Path;

            if (context.Request.Path.StartsWithSegments("/app"))
            {
                if (context.WebSockets.IsWebSocketRequest)
                {
                    string subProtocol = null;
                    foreach (string supportedProtocol in SupportedProtocols)
                    {
                        if (context.WebSockets.WebSocketRequestedProtocols.Contains(supportedProtocol))
                        {
                            subProtocol = supportedProtocol;
                            break;
                        }
                    }
                    using (WebSocket webSocket = await context.WebSockets.AcceptWebSocketAsync(subProtocol))
                    {
                        if (!webSockets.Contains(webSocket))
                        {
                            webSockets.Add(webSocket);
                            await TriggerAppMessage(webSocket, "I have recie your message");
                        }
                    }
                }
                await context.Response.WriteAsync(string.Format("Running...\r\n\r\n{0} chargepoints connected", webSockets.Count));
            }
            if (url== "/test")
            {
                var options = typeof(ClientWebSocket).GetProperty("Options", System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic)?.GetValue(this) as WebSocketOptions;
                  
                await context.Response.WriteAsync(string.Format("Running...\r\n\r\n{0} buffe", options?.ReceiveBufferSize.ToString() ?? "0"));
            }
            if (url == "/Getlistwebsocket")
            {
                context.Response.ContentType = "text/plain";
                string lstwEbsocket = "";
                foreach(var item in _chargePointStatusDict.ToList())
                {
                    lstwEbsocket += item.Value.Id+",";
                }
                await context.Response.WriteAsync(string.Format("Running...\r\n\r\n{0} chargepoints connected", lstwEbsocket));
            }
            
            if (url == "/StopTriggerMessages")
            {
                context.Response.ContentType = "text/plain";
                var query = context.Request.Query;
                string id = query["id"];
                int connectorID = 0;
                string ChargePointIdSplit = "";
                ChargePointIdSplit = id.Substring(0, id.Length - 1);
                connectorID = int.Parse(id.Substring(id.Length - 1, 1));
                foreach (var item in _chargePointStatusDict.ToList())
                {
                    if (item.Value.Id == ChargePointIdSplit)
                    {
                        await StopTriggerMessage(item.Value.WebSocket, connectorID);
                    }
                }
                await context.Response.WriteAsync(string.Format("Running...\r\n\r\n{0} chargepoints connected", "TriggerMessage"));
            }           

            if (url == "/TriggerMessages")
            {
                context.Response.ContentType = "text/plain";
                var query = context.Request.Query;
                string id = query["id"];
                string message = query["message"].ToString();
                int connectorID = 0;
                string ChargePointIdSplit = "";
                ChargePointIdSplit = id.Substring(0, id.Length - 1);
                connectorID = int.Parse(id.Substring(id.Length - 1,1));
                foreach (var item in _chargePointStatusDict.ToList())
                {
                    if (item.Value.Id == ChargePointIdSplit)
                    {
                        await TriggerMessage(item.Value.WebSocket, message,connectorID);
                    }
                }
                await context.Response.WriteAsync(string.Format("Running...\r\n\r\n{0} chargepoints connected", "TriggerMessage"));
            }
            if (url == "/ChargingSchedule")
            {
                context.Response.ContentType = "text/plain";
                var query = context.Request.Query;
                string id = query["id"]; 
                decimal upperLimit = decimal.Parse(query["upperLimit"]);
                int transactionid = int.Parse(query["transactionid"]);
                int connectorID = 0;
                string ChargePointIdSplit = "";
                ChargePointIdSplit = id.Substring(0, id.Length - 1);
                connectorID = int.Parse(id.Substring(id.Length - 1, 1));
                foreach (var item in _chargePointStatusDict.ToList())
                {
                    if (item.Value.Id == ChargePointIdSplit)
                    {
                        await ChargingSchedules(item.Value.WebSocket, connectorID, upperLimit, transactionid, _configuration);
                    }
                }
                await context.Response.WriteAsync(string.Format("Running...\r\n\r\n{0} chargepoints connected", "TriggerMessage"));
            }
            if (url == "/SetChargingProfile")
            {
                context.Response.ContentType = "text/plain";
                var query = context.Request.Query;
                string id = query["id"];
                decimal upperLimit = decimal.Parse(query["upperLimit"]);
                int transactionid = int.Parse(query["transactionid"]);
                int connectorID = 0;
                string ChargePointIdSplit = "";
                ChargePointIdSplit = id.Substring(0, id.Length - 1);
                connectorID = int.Parse(id.Substring(id.Length - 1, 1));
                foreach (var item in _chargePointStatusDict.ToList())
                {
                    if (item.Value.Id == ChargePointIdSplit)
                    {
                        await SetChargingProfileToDevice(item.Value.WebSocket, connectorID, upperLimit, transactionid, _configuration);
                    }
                }
                await context.Response.WriteAsync(string.Format("Running...\r\n\r\n{0} SetChargingProfile sent", "OK"));
            }
            if (url== "/ResponseStop")
            {
                context.Response.ContentType = "text/plain";
                var query = context.Request.Query;
                string id = query["id"];
                foreach (var item in _chargePointStatusDict.ToList())
                {
                    if (item.Value.Id == id)
                    {
                        await GetResponseStop(item.Value.WebSocket);
                        OCPPMessage msg = new OCPPMessage();

                    }
                }
                await context.Response.WriteAsync(string.Format("Running...\r\n\r\n{0} chargepoints get GetConfiguration", "GetConfiguration"));
            }
            if (url == "/RemoteStartTransaction")
            {
                var query = context.Request.Query;
                string id = query["id"];
                var bakupid = id;
                id= id.Substring(0, id.Length - 1);
                int ConnectorId = int.Parse(bakupid.Substring(bakupid.Length - 1, 1));
                string TagId = query["TagId"];
               
                // ===== QUAN TRỌNG: Bắt buộc balance >= 50.000 mới cho sạc (thống nhất với API RequireCharging) =====
                const decimal MinBalanceToStartCharge = 50000m;
                using (OCPPCoreContext dbContext = new OCPPCoreContext(_configuration))
                {
                    var userApp = dbContext.UserApps.Find(TagId);
                    if (userApp != null)
                    {
                        if (userApp.Balance < MinBalanceToStartCharge)
                        {
                            _logger.LogWarning("RemoteStartTransaction => UserApp '{0}' có balance={1} < {2}. Từ chối.", TagId, userApp.Balance, MinBalanceToStartCharge);
                            context.Response.StatusCode = (int)HttpStatusCode.BadRequest;
                            await context.Response.WriteAsync(string.Format("Balance must be greater than {0}. Current balance: {1}", MinBalanceToStartCharge, userApp.Balance));
                            return;
                        }
                    }
                }
               
                foreach (var item in _chargePointStatusDict.ToList())
                {
                    if (item.Value.Id == id)
                    {
                        await RemoteStartransaction(item.Value.WebSocket, TagId, ConnectorId);
                    }
                }
                await context.Response.WriteAsync(string.Format("Running...\r\n\r\n{0} chargepoints connected", "RemoteStartransaction"));
            }
            // ===== CHỨC NĂNG QR CODE (VNPay) ĐÃ BỊ VÔ HIỆU HÓA =====
            /*
            if (url == "/RemoteStartTransactionQR")
            {
                var query = context.Request.Query;
                string id = query["id"];
                var bakupid = id;
                string ChargePointId = "";
                int ConnectorId = 0;
                //Get charepointid from ConnectorStatus
                using (OCPPCoreContext dbContext = new OCPPCoreContext(_configuration))
                {
                    var getdta = dbContext.ConnectorStatuses.Where(m => m.terminalId == id).FirstOrDefault();
                    ChargePointId = getdta.ChargePointId;
                    ConnectorId = getdta.ConnectorId;
                }
                   
                decimal Amount = decimal.Parse(query["Amount"]);
                string QrTrace = query["QrTrace"].ToString();
                foreach (var item in _chargePointStatusDict.ToList())
                {
                    //generate tag random
                    if (item.Value.Id == ChargePointId)
                    { 
                        var randomTagId = GenerateRandomString(8);
                        using (OCPPCoreContext dbContext = new OCPPCoreContext(_configuration))
                        {
                            while (dbContext.ChargeTags.Any(m => m.TagId == randomTagId))
                            {
                                randomTagId = GenerateRandomString(8);
                            }

                            ChargeTag chargeTag = new ChargeTag();
                            chargeTag.TagId = randomTagId;
                            chargeTag.TagName = "QR-Temp-" + randomTagId;
                            chargeTag.CreateDate = DateTime.Now;
                            chargeTag.SideId = "3";
                            chargeTag.ChargeStationId = 1;
                            chargeTag.TagState = "1";
                            chargeTag.Blocked = false;
                            chargeTag.TagDescription = "Thẻ Tag tạm QR Code";
                            chargeTag.TagType = "QR_Payment";
                            dbContext.ChargeTags.Add(chargeTag);
                            dbContext.SaveChanges();

                            //Create transactionVituralQR
                            TransactionVirtualQR TransactionVirtualQR = new TransactionVirtualQR();
                            TransactionVirtualQR.ConnectorId = ConnectorId;
                            TransactionVirtualQR.ChargePointId = ChargePointId;
                            TransactionVirtualQR.CreateDate = DateTime.Now;
                            TransactionVirtualQR.Amount = Amount;
                            TransactionVirtualQR.TransactionId = 0;
                            TransactionVirtualQR.qrTrace = QrTrace;
                            dbContext.TransactionVirtualQRs.Add(TransactionVirtualQR);
                            try
                            {
                                dbContext.SaveChanges();
                            }
                            catch(Exception ex)
                            {

                            }
                           
                        }
                        await RemoteStartransactionQR(item.Value.WebSocket, randomTagId, ConnectorId);
                        
                    }
                }
                await context.Response.WriteAsync(string.Format("Running...\r\n\r\n{0} chargepoints connected", "RemoteStartransaction"));
            }
            */
            if (url == "/RemoteStopTransaction")
            {
                var query = context.Request.Query;
                string id = query["id"];
                int TransactionId = int.Parse(query["TransactionId"]);
                foreach (var item in _chargePointStatusDict.ToList())
                {
                    if (item.Value.Id == id)
                    {
                        await RemoteStopransaction(item.Value.WebSocket,TransactionId);
                    }
                }
                await context.Response.WriteAsync(string.Format("Running...\r\n\r\n{0} chargepoints connected", "RemoteStartransaction"));
            }
            _logger.LogTrace("OCPPMiddleware => Websocket request: Path='{0}'", context.Request.Path);
           
            ChargePointStatus chargePointStatus = null;

            if (context.Request.Path.StartsWithSegments("/OCPP") || context.Request.Path.StartsWithSegments("/app"))
            {
                string chargepointIdentifier;
                string[] parts = context.Request.Path.Value.Split('/');
                if (string.IsNullOrWhiteSpace(parts[parts.Length - 1]))
                {
                    chargepointIdentifier = parts[parts.Length - 2];
                }
                else
                {
                    chargepointIdentifier = parts[parts.Length - 1];
                }
                _logger.LogInformation("OCPPMiddleware => Connection request with chargepoint identifier = '{0}'", chargepointIdentifier);

                // Known chargepoint?
                if (!string.IsNullOrWhiteSpace(chargepointIdentifier))
                {
                    using (OCPPCoreContext dbContext = new OCPPCoreContext(_configuration))
                    {
                        ChargePoint chargePoint = dbContext.Find<ChargePoint>(chargepointIdentifier);
                        if (chargePoint != null)
                        {
                            _logger.LogInformation("OCPPMiddleware => SUCCESS: Found chargepoint with identifier={0}", chargePoint.ChargePointId);

                            // Check optional chargepoint authentication
                            if (!string.IsNullOrWhiteSpace(chargePoint.Username))
                            {
                                // Chargepoint MUST send basic authentication header

                                bool basicAuthSuccess = false;
                                string authHeader = context.Request.Headers["Authorization"];
                                if (!string.IsNullOrEmpty(authHeader))
                                {
                                    string[] cred = System.Text.ASCIIEncoding.ASCII.GetString(Convert.FromBase64String(authHeader.Substring(6))).Split(':');
                                    if (cred.Length == 2 && chargePoint.Username == cred[0] && chargePoint.Password == cred[1])
                                    {
                                        // Authentication match => OK
                                        _logger.LogInformation("OCPPMiddleware => SUCCESS: Basic authentication for chargepoint '{0}' match", chargePoint.ChargePointId);
                                        basicAuthSuccess = true;
                                    }
                                    else
                                    {
                                        // Authentication does NOT match => Failure
                                        _logger.LogWarning("OCPPMiddleware => FAILURE: Basic authentication for chargepoint '{0}' does NOT match", chargePoint.ChargePointId);
                                    }
                                }
                                if (basicAuthSuccess == false)
                                {
                                    context.Response.Headers.Add("WWW-Authenticate", "Basic realm=\"FocusEV.OCPP\"");
                                    context.Response.StatusCode = (int)HttpStatusCode.Unauthorized;
                                    return;
                                }

                            }
                            else if (!string.IsNullOrWhiteSpace(chargePoint.ClientCertThumb))
                            {
                                // Chargepoint MUST send basic authentication header
                                bool certAuthSuccess = false;
                                X509Certificate2 clientCert = context.Connection.ClientCertificate;
                                if (clientCert != null)
                                {
                                    if (clientCert.Thumbprint.Equals(chargePoint.ClientCertThumb, StringComparison.InvariantCultureIgnoreCase))
                                    {
                                        // Authentication match => OK
                                        _logger.LogInformation("OCPPMiddleware => SUCCESS: Certificate authentication for chargepoint '{0}' match", chargePoint.ChargePointId);
                                        certAuthSuccess = true;
                                    }
                                    else
                                    {
                                        // Authentication does NOT match => Failure
                                        _logger.LogWarning("OCPPMiddleware => FAILURE: Certificate authentication for chargepoint '{0}' does NOT match", chargePoint.ChargePointId);
                                    }
                                }
                                if (certAuthSuccess == false)
                                {
                                    context.Response.StatusCode = (int)HttpStatusCode.Unauthorized;
                                    return;
                                }
                            }
                            else
                            {
                                _logger.LogInformation("OCPPMiddleware => No authentication for chargepoint '{0}' configured", chargePoint.ChargePointId);
                            }

                            // Store chargepoint data
                            chargePointStatus = new ChargePointStatus(chargePoint);
                        }
                        else
                        {
                            _logger.LogWarning("OCPPMiddleware => FAILURE: Found no chargepoint with identifier={0}", chargepointIdentifier);
                        }
                    }
                }

                if (chargePointStatus != null)
                {
                    if (context.WebSockets.IsWebSocketRequest)
                    {
                        // Match supported sub protocols
                        string subProtocol = null;
                        foreach (string supportedProtocol in SupportedProtocols)
                        {
                            if (context.WebSockets.WebSocketRequestedProtocols.Contains(supportedProtocol))
                            {
                                subProtocol = supportedProtocol;
                                break;
                            }
                        }
                        if (string.IsNullOrEmpty(subProtocol))
                        {
                            // Not matching protocol! => failure
                            string protocols = string.Empty;
                            foreach (string p in context.WebSockets.WebSocketRequestedProtocols)
                            {
                                if (string.IsNullOrEmpty(protocols)) protocols += ",";
                                protocols += p;
                            }
                            _logger.LogWarning("OCPPMiddleware => No supported sub-protocol in '{0}' from charge station '{1}'", protocols, chargepointIdentifier);
                            context.Response.StatusCode = (int)HttpStatusCode.BadRequest;
                        }
                        else
                        {
                            chargePointStatus.Protocol = subProtocol;

                            bool statusSuccess = false;
                            try
                            {
                                _logger.LogTrace("OCPPMiddleware => Store/Update status object");

                                lock (_chargePointStatusDict)
                                {
                                    // Check if this chargepoint already/still hat a status object
                                    if (_chargePointStatusDict.ContainsKey(chargepointIdentifier))
                                    {
                                        // exists => check status
                                        if (_chargePointStatusDict[chargepointIdentifier].WebSocket.State != WebSocketState.Open)
                                        {
                                            ResponseLog slog = new ResponseLog();
                                            slog.isType = "Client disconnect"; 
                                            // Closed or aborted => remove
                                            _chargePointStatusDict.Remove(chargepointIdentifier);
                                        }
                                    }

                                    _chargePointStatusDict.Add(chargepointIdentifier, chargePointStatus);
                                    statusSuccess = true;
                                }
                            }
                            catch(Exception exp)
                            {
                                _logger.LogError(exp, "OCPPMiddleware => Error storing status object in dictionary => refuse connection");
                                context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
                            }

                            if (statusSuccess)
                            {
                                // Handle socket communication
                                _logger.LogTrace("OCPPMiddleware => Waiting for message...");

                                using (WebSocket webSocket = await context.WebSockets.AcceptWebSocketAsync(subProtocol))
                                {
                                    _logger.LogTrace("OCPPMiddleware => WebSocket connection with charge point '{0}'", chargepointIdentifier);
                                    chargePointStatus.WebSocket = webSocket;
                                    if (!webSockets.Contains(webSocket))
                                    {
                                        webSockets.Add(webSocket);
                                    }
                                   
                                    if (subProtocol == Protocol_OCPP20)
                                    {
                                        // OCPP V2.0
                                        await Receive20(chargePointStatus, context);
                                    }
                                    else
                                    {
                                        // OCPP V1.6
                                        await Receive16(chargePointStatus, context);
                                    }
                                }
                            }
                        }
                    }
                    else
                    {
                        // no websocket request => failure
                        _logger.LogWarning("OCPPMiddleware => Non-Websocket request");
                        context.Response.StatusCode = (int)HttpStatusCode.BadRequest;
                    }
                }
                else
                {
                    // unknown chargepoint
                    _logger.LogTrace("OCPPMiddleware => no chargepoint: http 412");
                    context.Response.StatusCode = (int)HttpStatusCode.PreconditionFailed;
                }
            }
            else if (context.Request.Path.StartsWithSegments("/API"))
            {
                // Check authentication (X-API-Key)
                string apiKeyConfig = _configuration.GetValue<string>("ApiKey");
                if (!string.IsNullOrWhiteSpace(apiKeyConfig))
                {
                    // ApiKey specified => check request
                    string apiKeyCaller = context.Request.Headers["X-API-Key"].FirstOrDefault();
                    if (apiKeyConfig == apiKeyCaller)
                    {
                        // API-Key matches
                        _logger.LogInformation("OCPPMiddleware => Success: X-API-Key matches");
                    }
                    else
                    {
                        // API-Key does NOT matches => authentication failure!!!
                        _logger.LogWarning("OCPPMiddleware => Failure: Wrong X-API-Key! Caller='{0}'", apiKeyCaller);
                        context.Response.StatusCode = (int)HttpStatusCode.Unauthorized;
                        return;
                    }
                }
                else
                {
                    // No API-Key configured => no authenticatiuon
                    _logger.LogWarning("OCPPMiddleware => No X-API-Key configured!");
                }

                // format: /API/<command>[/chargepointId]
                string[] urlParts = context.Request.Path.Value.Split('/');

                if (urlParts.Length >= 3)
                {
                    string cmd = urlParts[2];
                    string urlChargePointId = (urlParts.Length >= 4) ? urlParts[3] : null;
                    _logger.LogTrace("OCPPMiddleware => cmd='{0}' / id='{1}' / FullPath='{2}')", cmd, urlChargePointId, context.Request.Path.Value);

                    if (cmd == "Status")
                    {
                        try
                        {
                            List<ChargePointStatus> statusList = new List<ChargePointStatus>();
                            foreach (ChargePointStatus status in _chargePointStatusDict.Values)
                            {
                                statusList.Add(status);
                            }
                            string jsonStatus = JsonConvert.SerializeObject(statusList);
                            context.Response.ContentType = "application/json";
                            await context.Response.WriteAsync(jsonStatus);
                        }
                        catch (Exception exp)
                        {
                            _logger.LogError(exp, "OCPPMiddleware => Error: {0}", exp.Message);
                            context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
                        }
                    }
                    else if (cmd == "Reset")
                    {
                        if (!string.IsNullOrEmpty(urlChargePointId))
                        {
                            try
                            {
                                ChargePointStatus status = null;
                                if (_chargePointStatusDict.TryGetValue(urlChargePointId, out status))
                                {
                                    // Send message to chargepoint
                                    if (status.Protocol == Protocol_OCPP20)
                                    {
                                        // OCPP V2.0
                                        await Reset20(status, context);
                                    }
                                    else
                                    {
                                        // OCPP V1.6
                                        await Reset16(status, context);
                                    }
                                }
                                else
                                {
                                    // Chargepoint offline
                                    _logger.LogError("OCPPMiddleware SoftReset => Chargepoint offline: {0}", urlChargePointId);
                                    context.Response.StatusCode = (int)HttpStatusCode.NotFound;
                                }
                            }
                            catch (Exception exp)
                            {
                                _logger.LogError(exp, "OCPPMiddleware SoftReset => Error: {0}", exp.Message);
                                context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
                            }
                        }
                        else
                        {
                            _logger.LogError("OCPPMiddleware SoftReset => Missing chargepoint ID");
                            context.Response.StatusCode = (int)HttpStatusCode.BadRequest;
                        }
                    }
                    else if (cmd == "UnlockConnector")
                    {
                        if (!string.IsNullOrEmpty(urlChargePointId))
                        {
                            try
                            {
                                ChargePointStatus status = null;
                                if (_chargePointStatusDict.TryGetValue(urlChargePointId, out status))
                                {
                                    // Send message to chargepoint
                                    if (status.Protocol == Protocol_OCPP20)
                                    {
                                        // OCPP V2.0
                                        await UnlockConnector20(status, context);
                                    }
                                    else
                                    {
                                        // OCPP V1.6
                                        await UnlockConnector16(status, context);
                                    }
                                }
                                else
                                {
                                    // Chargepoint offline
                                    _logger.LogError("OCPPMiddleware UnlockConnector => Chargepoint offline: {0}", urlChargePointId);
                                    context.Response.StatusCode = (int)HttpStatusCode.NotFound;
                                }
                            }
                            catch (Exception exp)
                            {
                                _logger.LogError(exp, "OCPPMiddleware UnlockConnector => Error: {0}", exp.Message);
                                context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
                            }
                        }
                        else
                        {
                            _logger.LogError("OCPPMiddleware UnlockConnector => Missing chargepoint ID");
                            context.Response.StatusCode = (int)HttpStatusCode.BadRequest;
                        }
                    }
                    else
                    {
                        // Unknown action/function
                        _logger.LogWarning("OCPPMiddleware => action/function: {0}", cmd);
                        context.Response.StatusCode = (int)HttpStatusCode.NotFound;
                    }
                }
            }
            else if (context.Request.Path.StartsWithSegments("/"))
            {
                try
                {
                    bool showIndexInfo = _configuration.GetValue<bool>("ShowIndexInfo");
                    if (showIndexInfo)
                    {
                        _logger.LogTrace("OCPPMiddleware => Index status page");

                        context.Response.ContentType = "text/plain";
                        await context.Response.WriteAsync(string.Format("Running...\r\n\r\n{0} chargepoints connected", _chargePointStatusDict.Values.Count));
                    }
                    else
                    {
                        _logger.LogInformation("OCPPMiddleware => Root path with deactivated index page");
                        context.Response.StatusCode = (int)HttpStatusCode.BadRequest;
                    }
                }
                catch (Exception exp)
                {
                    _logger.LogError(exp, "OCPPMiddleware => Error: {0}", exp.Message);
                    context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
                }
            }
            else
            {
                _logger.LogWarning("OCPPMiddleware => Bad path request");
                context.Response.StatusCode = (int)HttpStatusCode.BadRequest;
            }
        }
    }

    public static class OCPPMiddlewareExtensions
    {
        public static IApplicationBuilder UseOCPPMiddleware(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<OCPPMiddleware>();
        }
    }
}
