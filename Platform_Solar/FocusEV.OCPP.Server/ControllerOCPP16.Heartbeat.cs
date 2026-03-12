
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
        public string HandleHeartBeat(OCPPMessage msgIn, OCPPMessage msgOut)
        {
            string errorCode = null;

            Logger.LogTrace("Processing heartbeat...");
            HeartbeatResponse heartbeatResponse = new HeartbeatResponse();
            //heartbeatResponse.CurrentTime = DateTimeOffset.UtcNow;
            //heartbeatResponse.CurrentTime = DateTimeOffset.UtcNow.AddHours(7);    //thêm 7h để trụ sạc synchronize timestamp đúng với UTC+7
            heartbeatResponse.CurrentTime = DateTime.UtcNow;   //lấy giờ hệ thống của máy tính hiện tại



            msgOut.JsonPayload = JsonConvert.SerializeObject(heartbeatResponse);
            Logger.LogTrace("Heartbeat => Response serialized");

            WriteMessageLog(ChargePointStatus?.Id, null, msgIn.Action, null, errorCode);

            //Cập nhật Lastseen cho ConnectorStatus
            using (OCPPCoreContext dbContext = new OCPPCoreContext(Configuration))
            {
                var listCinnector = dbContext.ConnectorStatuses.Where(m => m.ChargePointId == ChargePointStatus.Id).ToList();
                foreach (var item in listCinnector)
                {
                    item.lastSeen = DateTime.Now;
                }
                dbContext.SaveChanges();
            }
            return errorCode;
        }
    }
}



