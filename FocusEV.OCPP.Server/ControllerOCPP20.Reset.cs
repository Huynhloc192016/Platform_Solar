

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using FocusEV.OCPP.Database;
using FocusEV.OCPP.Server.Messages_OCPP20;

namespace FocusEV.OCPP.Server
{
    public partial class ControllerOCPP20
    {
        public void HandleReset(OCPPMessage msgIn, OCPPMessage msgOut)
        {
            Logger.LogInformation("Reset answer: ChargePointId={0} / MsgType={1} / ErrCode={2}", ChargePointStatus.Id, msgIn.MessageType, msgIn.ErrorCode);

            try
            {
                ResetResponse resetResponse = JsonConvert.DeserializeObject<ResetResponse>(msgIn.JsonPayload);
                Logger.LogInformation("Reset => Answer status: {0}", resetResponse?.Status);
                WriteMessageLog(ChargePointStatus?.Id, null, msgOut.Action, resetResponse?.Status.ToString(), msgIn.ErrorCode);

                if (msgOut.TaskCompletionSource != null)
                {
                    // Set API response as TaskCompletion-result
                    string apiResult = "{\"status\": " + JsonConvert.ToString(resetResponse.Status.ToString()) + "}";
                    Logger.LogTrace("HandleReset => API response: {0}" , apiResult);

                    msgOut.TaskCompletionSource.SetResult(apiResult);
                }
            }
            catch (Exception exp)
            {
                Logger.LogError(exp, "HandleReset => Exception: {0}", exp.Message);
            }
        }
    }
}
