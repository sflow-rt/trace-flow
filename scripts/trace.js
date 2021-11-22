// author: InMon Corp.
// version: 2.1
// date: 11/22/2021
// description: Trace packet paths across topology
// copyright: Copyright (c) 2017-2021 InMon Corp. ALL RIGHTS RESERVED

var t = getSystemProperty('trace-flow.t') || 10;
var n = getSystemProperty('trace-flow.n') || 10;
var minValue = getSystemProperty('trace-flow.minValue') || 1;

var keys = 'inputifindex,outputifindex';
var value = 'frames';

var userFlows = {};
var specID = 0;
function flowSpecName(filter) {
  if(!filter) return null;

  var entry = userFlows[filter];
  if(!entry) {
    var name = 'trace_flow_' + specID;
    try {
      setFlow(name,{keys:keys,value:value,filter:filter,t:t,n:n});
      entry = {name:name};
      userFlows[filter] = entry;
      specID++;
    }
    catch(e) {
      entry = null;
    }
  }
  if(!entry) return null;
  entry.lastQuery = Date.now();
  return entry.name;
}

setIntervalHandler(function(now) {
  var key, entry;
  for(key in userFlows) {
    entry = userFlows[key];
    if(now - entry.lastQuery > 10000) {
      clearFlow(entry.name);
      delete userFlows[key];
    }
  }
},10);

function escapeRegExp(str) {
  // seems like a bug - Rhino doesn't convert Java strings into native JavaScript strings
  str = new String(str);
  return str ? str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&") : null;
}

function updateTopology(top, link, fromnode, tonode) {
  top.nodes[fromnode] = top.nodes[fromnode]||{};
  top.nodes[tonode] = top.nodes[tonode]||{};
  var edge = top.edges[link];
  if(edge) {
    if(edge.from !== fromnode) {
      edge.bidirectional=true;
    }
  } else {
    top.edges[link] = {from:fromnode,to:tonode,bidirectional:false};
  }
}

function getTopology(name) {
  var res = dump('TOPOLOGY',name);
  var top = {nodes:{}, edges:{}};
  for(var i = 0; i < res.length; i++) {
    let entry = res[i];
    let agent = entry.agent;
    let keys = entry.topKeys;
    for(var j = 0; j < keys.length; j++) {
      if(keys[j].value < minValue) break;

      let [input,output] = keys[j].key.split(',');
      let link = topologyInterfaceToLink(agent,input);
      if(link) {
        updateTopology(top,link.linkname,link.remotenode,link.localnode);
      } else {
        let port = topologyInterfaceToPort(agent,input);
        if(port&&'internal'!=input&&'unknown'!=input&&'multiple'!=input&&'discard'!=input) {
          let macs = topologyLocatedHostMacs(agent,input);
          let pid = port.node+'-'+(port.port||input);
          updateTopology(top,pid,pid,port.node);
          top.edges[pid]['label'] = port.port||input;
          top.nodes[pid]['label'] = macs.length == 1 ? macs[0] : port.port||input;
          top.nodes[pid]['port'] = true;
        }
      }
      link = topologyInterfaceToLink(agent,output);
      if(link) {
        updateTopology(top,link.linkname,link.localnode,link.remotenode);
      } else {
        let port = topologyInterfaceToPort(agent,output);
        if(port&&'internal'!=output&&'unknown'!=output&&'multiple'!=output&&'discard'!=output) {
          let macs = topologyLocatedHostMacs(agent,output);
          let pid = port.node+'-'+(port.port||output);
          updateTopology(top,pid,port.node,pid);
          top.edges[pid]['label'] = port.port||output;
          top.nodes[pid]['label'] = macs.length == 1 ? macs[0] : port.port||output;
          top.nodes[pid]['port'] = true;
        }
      }
    }
  }
  return top;
}

setHttpHandler(function(req) {
  var result, search, matcher, filter, name, path = req.path;
  if(!path || path.length !== 1) throw "not_found";

  switch(path[0]) {
  case 'flowkeys':
    result = [];
    search = req.query['search'];
    if(search) {
      matcher = new RegExp('^' + escapeRegExp(search), 'i');
      for(key in flowKeys()) {
        if(matcher.test(key)) result.push(key);
      }
    } else {
      for(key in flowKeys()) result.push(key);
    }
    result.sort();
    break;
  case 'trace':
    filter = req.query['filter'] ? req.query['filter'].join('&') : '';
    name = flowSpecName(filter);
    if(!name) throw 'bad_request';
    result = getTopology(name);
    break;
  }
  return result;
});
  
