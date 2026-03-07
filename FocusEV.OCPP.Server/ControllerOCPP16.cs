using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using FocusEV.OCPP.Database;
using FocusEV.OCPP.Server.Messages_OCPP16;
using System.Linq;

namespace FocusEV.OCPP.Server
{
    public partial class ControllerOCPP16 : ControllerBase
    {
        /// <summary>
        /// Constructor
        /// </summary>
        public ControllerOCPP16(IConfiguration config, ILoggerFactory loggerFactory, ChargePointStatus chargePointStatus) :
            base(config, loggerFactory, chargePointStatus)
        {
            Logger = loggerFactory.CreateLogger(typeof(ControllerOCPP16));
        }

        /// <summary>
        /// Processes the charge point message and returns the answer message
        /// </summary>
        public OCPPMessage ProcessRequest(OCPPMessage msgIn)
        {
            OCPPMessage msgOut = new OCPPMessage();
            msgOut.MessageType = "3";
            msgOut.UniqueId = msgIn.UniqueId;

            string errorCode = null;

            switch (msgIn.Action)
            {
                case "BootNotification":
                    errorCode = HandleBootNotification(msgIn, msgOut);
                    break;

                case "Heartbeat":
                    errorCode = HandleHeartBeat(msgIn, msgOut);
                    break;

                case "Authorize":
                    errorCode = HandleAuthorize(msgIn, msgOut);
                    break;

                case "StartTransaction":
                    errorCode = HandleStartTransaction(msgIn, msgOut);
                    break;

                case "StopTransaction":
                    errorCode = HandleStopTransaction(msgIn, msgOut);
                    break;

                case "MeterValues":
                    errorCode = HandleMeterValues(msgIn, msgOut);
                    break;

                case "StatusNotification":
                    errorCode = HandleStatusNotification(msgIn, msgOut);
                    break;

                case "DataTransfer":
                    errorCode = HandleDataTransfer(msgIn, msgOut);
                    break;
                case "GetChargerPower":
                    errorCode = HandleGetChargerPower(msgIn, msgOut);
                    break;
                default:
                    errorCode = ErrorCodes.NotSupported;
                    WriteMessageLog(ChargePointStatus.Id, null, msgIn.Action, msgIn.JsonPayload, errorCode);
                    break;
            }

            if (!string.IsNullOrEmpty(errorCode))
            {
                // Inavlid message type => return type "4" (CALLERROR)
                msgOut.MessageType = "4";
                msgOut.ErrorCode = errorCode;
                Logger.LogDebug("ControllerOCPP16 => Return error code messge: ErrorCode={0}", errorCode);
            }

            return msgOut;
        }


        /// <summary>
        /// Processes the charge point message and returns the answer message
        /// </summary>
        public void ProcessAnswer(OCPPMessage msgIn, OCPPMessage msgOut)
        {
            // The response (msgIn) has no action => check action in original request (msgOut)
            switch (msgOut.Action)
            {
                case "Reset":
                    HandleReset(msgIn, msgOut);
                    break;

                case "UnlockConnector":
                    HandleUnlockConnector(msgIn, msgOut);
                    break;

                default:
                    WriteMessageLog(ChargePointStatus.Id, null, msgIn.Action, msgIn.JsonPayload, "Unknown answer");
                    break;
            }
        }

        /// <summary>
        /// Helper function for writing a log entry in database
        /// </summary>

        private void LogOCPP(string contents)
        {
            try
            {
                using (OCPPCoreContext dbContext = new OCPPCoreContext(Configuration))
                {
                    ResponseLog responseLog = new ResponseLog();
                    responseLog.isType = "LogInformation";
                    responseLog.isResponse = contents;
                    responseLog.CreateDate = DateTime.Now;
                    dbContext.ResponseLogs.Add(responseLog);
                    dbContext.SaveChanges();

                }
            }
            catch (Exception ex)
            {

            }  
        }
        
        private bool WriteMessageLog(string chargePointId, int? connectorId, string message, string result, string errorCode)
        {
            try
            {
                int dbMessageLog = Configuration.GetValue<int>("DbMessageLog", 0);
                if (dbMessageLog > 0 && !string.IsNullOrWhiteSpace(chargePointId))
                {
                    bool doLog = (dbMessageLog > 1 ||
                                    (message != "BootNotification" &&
                                     message != "Heartbeat" &&
                                     message != "DataTransfer" &&
                                     message != "StatusNotification"));

                    if (doLog)
                    {
                        using (OCPPCoreContext dbContext = new OCPPCoreContext(Configuration))
                        {
                            MessageLog msgLog = new MessageLog();
                            msgLog.ChargePointId = chargePointId;
                            msgLog.ConnectorId = connectorId;
                            msgLog.LogTime = DateTime.UtcNow;
                            msgLog.Message = message;
                            msgLog.Result = result;
                            msgLog.ErrorCode = errorCode;
                            dbContext.MessageLogs.Add(msgLog);
                            Logger.LogTrace("MessageLog => Writing entry '{0}'", message);
                          
                            dbContext.SaveChanges();
                            //Update DataTransferStatus for wallettransaction
                            if (message == "DataTransfer")
                            {
                                var findwallet = dbContext.TransactionVirtuals.Where(m => m.ChargePointId == chargePointId).FirstOrDefault();
                                if (findwallet != null)
                                {
                                    WalletTransaction WalletTransaction = dbContext.WalletTransactions.Where(m => m.TransactionId == findwallet.TransactionId).FirstOrDefault();
                                    WalletTransaction.DataTransferStatus = message;
                                    dbContext.SaveChanges();
                                }
                            }
                            

                        }
                        return true;
                    }
                }
            }
            catch (Exception exp)
            {
                Logger.LogError(exp, "MessageLog => Error writing entry '{0}'", message);
            }
            return false;
        }
    }
}
