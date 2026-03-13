using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using FocusEV.OCPP.Database;
using FocusEV.OCPP.Server.Messages_OCPP16;

namespace FocusEV.OCPP.Server
{
    public partial class ControllerBase
    {
        /// <summary>
        /// Configuration context for reading app settings
        /// </summary>
        protected IConfiguration Configuration { get; set; }

        /// <summary>
        /// Chargepoint status
        /// </summary>
        protected ChargePointStatus ChargePointStatus { get; set; }

        /// <summary>
        /// ILogger object
        /// </summary>
        protected ILogger Logger { get; set; }

        /// <summary>
        /// Constructor
        /// </summary>
        public ControllerBase(IConfiguration config, ILoggerFactory loggerFactory, ChargePointStatus chargePointStatus)
        {
            Configuration = config;

            if (chargePointStatus != null)
            {
                ChargePointStatus = chargePointStatus;
            }
            else
            {
                Logger.LogError("New ControllerBase => empty chargepoint status");
            }
        }


        /// <summary>
        /// Helper function for creating and updating the ConnectorStatus in then database
        /// </summary>
        protected bool UpdateConnectorStatus(int connectorId, string status, DateTimeOffset? statusTime, double? meter, DateTimeOffset? meterTime)
        {
            try
            {
                using (OCPPCoreContext dbContext = new OCPPCoreContext(Configuration))
                {
                    ConnectorStatus connectorStatus = dbContext.Find<ConnectorStatus>(ChargePointStatus.Id, connectorId);
                    if (connectorStatus == null)
                    {
                        // no matching entry => create connector status
                        connectorStatus = new ConnectorStatus();
                        connectorStatus.ChargePointId = ChargePointStatus.Id;
                        connectorStatus.ConnectorId = connectorId;
                        Logger.LogTrace("UpdateConnectorStatus => Creating new DB-ConnectorStatus: ID={0} / Connector={1}", connectorStatus.ChargePointId, connectorStatus.ConnectorId);
                        dbContext.Add<ConnectorStatus>(connectorStatus);
                    }

                    if (!string.IsNullOrEmpty(status))
                    {
                        connectorStatus.LastStatus = status;
                        connectorStatus.LastStatusTime = ((statusTime.HasValue) ? statusTime.Value : DateTimeOffset.UtcNow).DateTime;
                    }

                    if (meter.HasValue)
                    {
                        connectorStatus.LastMeter = meter.Value;
                        connectorStatus.LastMeterTime = ((meterTime.HasValue) ? meterTime.Value : DateTimeOffset.UtcNow).DateTime;
                    }
                    dbContext.SaveChanges();
                    Logger.LogInformation("UpdateConnectorStatus => Save ConnectorStatus: ID={0} / Connector={1} / Status={2} / Meter={3}", connectorStatus.ChargePointId, connectorId, status, meter);
                    return true;
                }
            }
            catch (Exception exp)
            {
                Logger.LogError(exp, "UpdateConnectorStatus => Exception writing connector status (ID={0} / Connector={1}): {2}", ChargePointStatus?.Id, connectorId, exp.Message);
            }

            return false;
        }

        /// <summary>
        /// Clean charge tag Id from possible suffix ("..._abc")
        /// </summary>
        protected static string CleanChargeTagId(string rawChargeTagId, ILogger logger)
        {
            string idTag = rawChargeTagId;

            // KEBA adds the serial to the idTag ("<idTag>_<serial>") => cut off suffix
            if (!string.IsNullOrWhiteSpace(rawChargeTagId))
            {
                int sep = rawChargeTagId.IndexOf('_');
                if (sep >= 0)
                {
                    idTag = rawChargeTagId.Substring(0, sep);
                    logger.LogTrace("CleanChargeTagId => Charge tag '{0}' => '{1}'", rawChargeTagId, idTag);
                }
            }

            return idTag;
        }

        protected static DateTimeOffset MaxExpiryDate
        {
            get
            {
                return new DateTime(2199, 12, 31);
            }
        }
    }
}
