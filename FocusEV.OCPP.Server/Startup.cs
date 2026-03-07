using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Net.WebSockets;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using FocusEV.OCPP.Database;

namespace FocusEV.OCPP.Server
{
    public class Startup
    {
        private ILoggerFactory LoggerFactory { get; set; }

        public Startup(IConfiguration configuration)
        {
            Configuration = configuration;
        }

        public IConfiguration Configuration { get; }

        // This method gets called by the runtime. Use this method to add services to the container.
        public void ConfigureServices(IServiceCollection services)
        {
            services.AddControllers();
        }

        // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
        //public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
        public void Configure(IApplicationBuilder app,
                            IWebHostEnvironment env,
                            ILoggerFactory loggerFactory)
        {
            LoggerFactory = loggerFactory;
            ILogger logger = loggerFactory.CreateLogger(typeof(Startup));
            logger.LogTrace("Startup => Configure(...)");

            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }

            // Set WebSocketsOptions
            var webSocketOptions = new WebSocketOptions() 
            {
                //ReceiveBufferSize = 8 * 1024
            };

            // Accept WebSocket
            app.UseWebSockets(webSocketOptions);

            // Integrate custom OCPP middleware for message processing
            app.UseOCPPMiddleware();
        }
    }
}
