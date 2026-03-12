

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
        public string HandleHeartBeat(OCPPMessage msgIn, OCPPMessage msgOut)
        {
            string errorCode = null;

            Logger.LogTrace("Processing heartbeat...");
            HeartbeatResponse heartbeatResponse = new HeartbeatResponse();
            heartbeatResponse.CustomData = new CustomDataType();
            heartbeatResponse.CustomData.VendorId = VendorId;

            heartbeatResponse.CurrentTime = DateTimeOffset.UtcNow;

            msgOut.JsonPayload = JsonConvert.SerializeObject(heartbeatResponse);
            Logger.LogTrace("Heartbeat => Response serialized");

            WriteMessageLog(ChargePointStatus?.Id, null, msgIn.Action, null, errorCode);
            return errorCode;
        }
    }
}
