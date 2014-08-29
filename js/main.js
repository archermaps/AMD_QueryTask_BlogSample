/*global define,document */
/*jslint sloppy:true,nomen:true */
/*
 | Copyright 2014 Esri
 |
 | Licensed under the Apache License, Version 2.0 (the "License");
 | you may not use this file except in compliance with the License.
 | You may obtain a copy of the License at
 |
 |    http://www.apache.org/licenses/LICENSE-2.0
 |
 | Unless required by applicable law or agreed to in writing, software
 | distributed under the License is distributed on an "AS IS" BASIS,
 | WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 | See the License for the specific language governing permissions and
 | limitations under the License.
 */
define(["dojo/ready", "dojo/_base/declare", "dojo/_base/lang", "dojo/query", "esri/toolbars/draw",
    "dijit/Dialog", "esri/arcgis/utils", "dojo/dom", "dojo/dom-class", "dojo/on", "esri/config",
    "esri/symbols/SimpleMarkerSymbol", "esri/symbols/SimpleLineSymbol", "esri/symbols/SimpleFillSymbol", "esri/tasks/QueryTask",
    "esri/tasks/query", "esri/tasks/StatisticDefinition",
    "esri/symbols/PictureFillSymbol", "esri/symbols/CartographicLineSymbol", "esri/graphic", "esri/TimeExtent", "esri/Color"],
    function (
    ready, declare, lang, query, draw, dialog, arcgisUtils, dom, domClass, on, esriConfig, SimpleMarkerSymbol,
    SimpleLineSymbol, SimpleFillSymbol, QueryTask, Query, StatisticDefinition, PictureFillSymbol,
    CartographicLineSymbol, Graphic, TimeExtent, Color) {
    
    return declare(null, {
        //Define all the variables that need to be available in the define function scope. These can be referenced
        //with "this." later on in the code. Global variables aren't nearly as useful with the AMD model.
        config: {},
        precipURL: "http://tmservices1.esri.com/arcgis/rest/services/LiveFeeds/NDFD_Precipitation/MapServer/2",
        precipQueryTask: new QueryTask(this.precipURL),
        searchGraphic: null,
        askBtn: null,
        polyBtn: null,
        queryBtn: null,
        toolbar: null,
        startup: function (config) {
            // config will contain application and user defined info for the template such as i18n strings, the web map id
            // and application id
            // any url parameters and any application specific configuration information.
            
            if (config) {
                this.config = config;
                // document ready
                ready(lang.hitch(this, function () {
                    //supply either the webmap id or, if available, the item info
                    var itemInfo = this.config.itemInfo || this.config.webmap;
                    this._createWebMap(itemInfo);
                }));
            } else {
                var error = new Error("Main:: Config is not defined");
                this.reportError(error);
            }
        },
        reportError: function (error) {
            // remove loading class from body
            domClass.remove(document.body, "app-loading");
            domClass.add(document.body, "app-error");
            // an error occurred - notify the user. In this example we pull the string from the
            // resource.js file located in the nls folder because we've set the application up
            // for localization. If you don't need to support multiple languages you can hardcode the
            // strings here and comment out the call in index.html to get the localization strings.
            // set message
            var node = dom.byId("loading_message");
            if (node) {
                if (this.config && this.config.i18n) {
                    node.innerHTML = this.config.i18n.map.error + ": " + error.message;
                } else {
                    node.innerHTML = "Unable to create map: " + error.message;
                }
            }
        },
        // Map is ready
        _mapLoaded: function () {
            // remove loading class from body
            domClass.remove(document.body, "app-loading");
            // your code here!
            // Note the use of "this" throughout the code.  It refers to the current execution scope. If you want to pass that 
            // around or expand it, you can use lang.hitch to pass "this" into another context and combine current scope with
            // the new scope.
            config = this.config;
            this.toolbar = new draw(this.map);
            var askHTML = '<div>1) Choose an area for the question: <button data-dojo-type="dijit/form/Button" id="polyBtn">Freehand Polygon</button>'+
              '</br>'+
              '</br>2) Show me <select id="maxmin">'+
              '    <option value="max" selected="true">Max</option>'+
              '    <option value="min">Min</option>'+
              '    <option value="sum">Sum</option>'+
              '</select> Precipitation for the next '+
              '<select id="hrs">'+
              '   <option value="6" selected="true">6</option>'+
              '   <option value="12">12</option>'+
              '    <option value="18">18</option>'+
              '    <option value="24">24</option>'+
              '    <option value="48">48</option>'+
              '    <option value="72">72</option>'+
              '</select> hours.'+
              '</br>'+
              '</br>'+
              '<button data-dojo-type="dijit/form/Button" type="button" id="queryBtn" text="submit"> Ask </button>'+
              '</div>';
            var askDialogObj = dojo.query('#askDialog');
            this.askMapDialog = new dijit.Dialog({
              content: askHTML,
              title: "Ask",
              style: "max-width: 660px;",
              class: "nonModal",
              id: "askMapDialog"
            });
            this.askBtn = dom.byId("askMap");
            this.polyBtn = dom.byId("polyBtn");
            this.queryBtn = dom.byId("queryBtn");
            // Here's the first place that lang.hitch comes in to the code.  Note that we are using it to execute code and 
            // pass along the current context "this" to the callback function.  In this case, the code that executes when 
            // the user clicks on the ask button.
            on(this.askBtn, "click", lang.hitch(this, function (event) {
                this.map.graphics.clear();
                if (event.type === 'click' || (event.type === 'keyup' && event.keyCode === 13)) {
                  this.askMapDialog.show();
                }
                if (this.map.infoWindow){
                  this.map.infoWindow.hide();
                }
            }));
            on(this.polyBtn, "click", lang.hitch(this, function(){
              this.drawPoly();
            }));
            on(this.queryBtn, "click", lang.hitch(this, function(){
              this.askMe();
            }));
            // This function is a little different animal, because we don't just call the function and have it execute.
            // It HAS to be wired exactly this way because the callback receives a feature result from the toolbar's draw-
            // end event.  We have to explicitly pass both the feature result and the context or the callback function won't
            // execute properly.
            this.toolbar.on("draw-end", lang.hitch(this, function(feature){
              this.addToMap(feature, false);
            }));
            
        },
        // create a map based on the input web map id
        _createWebMap: function (itemInfo) {
            arcgisUtils.createMap(itemInfo, "mapDiv", {
                mapOptions: {
                    // Optionally define additional map config here for example you can
                    // turn the slider off, display info windows, disable wraparound 180, slider position and more.
                },
                bingMapsKey: this.config.bingKey
            }).then(lang.hitch(this, function (response) {
                // Once the map is created we get access to the response which provides important info
                // such as the map, operational layers, popup info and more. This object will also contain
                // any custom options you defined for the template. In this example that is the 'theme' property.
                // Here' we'll use it to update the application to match the specified color theme.
                // console.log(this.config);
                
                this.map = response.map;
                // make sure map is loaded
                if (this.map.loaded) {
                    // do something with the map
                    this._mapLoaded();
                } else {
                    on.once(this.map, "load", lang.hitch(this, function () {
                        // do something with the map
                        this._mapLoaded().then(function(){
                          
                        });
                    }));
                }
            }), this.reportError);
        },
        askMe: function(){
          // use new 10.1 query statistic definition to find max, min, etc.
          var precipQueryTask = new QueryTask(this.precipURL);
          var TE = new TimeExtent();
          var precipQuery = new Query();
          var statDef = new StatisticDefinition();
          var precipFields = ["category", "fromdate", "todate", "label"];
          //Time Extent calculations
          var curTime = new Date();
          var startTimeMS = curTime.getTime();  //milliseconds
          var selTime = dojo.byId('hrs').value;
          var selTimeMS = selTime * 3600000;    //milliseconds
          var futTime = new Date();
          var futTimeMS = futTime.getTime();
          var endTime = new Date(futTimeMS + selTimeMS);
          var endTimeMS = endTime.getTime();
          var s = new Date(startTimeMS);  //convert to Date format for JSAPI
          var e = new Date(endTimeMS);    //convert to Date format for JSAPI
          TE.startTime = s;
          TE.endTime = e;
          //Set up the Query
          var statsDD = dojo.byId("maxmin").value;
          statDef.statisticType = statsDD;
          statDef.onStatisticField = "category";
          statDef.outStatisticFieldName = "statsPrecip";
          precipQuery.returnGeometry = true;
          precipQuery.timeExtent = TE;
          precipQuery.outFields = precipFields;
          precipQuery.outStatistics = [statDef];
          precipQuery.geometry = this.searchGraphic.geometry;
          precipQueryTask.execute(precipQuery, lang.hitch(this, function(results){
            this.handlePrecipQuery(results);
          }));
        },
        handlePrecipQuery: function(evt){
          this.askMapDialog.hide();
          console.log('precip query...', evt);
          var feat = evt.features[0];
          var statsPrecip = feat.attributes.statsPrecip;
          this.map.graphics.clear();
          this.askMapDialog.hide();
          this.toolbar.deactivate();
          alert('Query Done!!!' + dojo.byId("maxmin").value + ' Precip value = ' + statsPrecip);
        },
        drawPoly: function(){
          this.map.graphics.clear();
          this.askMapDialog.hide();
          this.toolbar.activate(draw.FREEHAND_POLYGON);
        },
        addToMap: function(feature, isResult) {
          var symbol;
          this.map.graphics.clear();
          switch (feature.geometry.type) {
            case "point":
            case "multipoint":
             if(isResult){
                symbol = new SimpleMarkerSymbol();
              }
              else{
                symbol = new SimpleMarkerSymbol();
              }
              break;
            case "polyline":
              if(isResult){
                symbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_DASHDOT,
                  new Color([255,0,0]), 2);
              }
              else{
                symbol = new SimpleLineSymbol();
              }
              break;
            default:
              if(isResult){
                symbol = new simpleFillSymbol(SimpleFillSymbol.STYLE_SOLID,
                  new SimpleLineSymbol(SimpleLineSymbol.STYLE_DASHDOT,
                  new Color([255,0,0]), 2),new Color([255,255,0,0.25]));
              }
              else{
                symbol = new SimpleFillSymbol();
              }
              break;
          }
          this.searchGraphic = new Graphic(feature.geometry, symbol);
          this.map.graphics.add(this.searchGraphic);
          this.toolbar.deactivate();
          this.askMapDialog.show();
        }
    });
});


