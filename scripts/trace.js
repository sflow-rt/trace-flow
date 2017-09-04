// author: InMon Corp.
// version: 1.0
// date: 9/2/2017
// description: Top Flows
// copyright: Copyright (c) 2017 InMon Corp. ALL RIGHTS RESERVED

var keys = 'inputifindex,outputifindex,or:ipttl:ip6ttl';
var value = 'frames';

var userFlows = {};
var specID = 0;
function flowSpecName(filter) {
  if(!filter) return null;

  var entry = userFlows[filter];
  if(!entry) {
    var name = 'trace_flow_' + specID;
    try {
      setFlow(name,{keys:keys,value:value,filter:filter,t:10,n:10});
      entry = {name:name};
      userFlows[filter] = entry;
      specID++;
    }
    catch(e) {
      entry = null;
    }
  }
  if(!entry) return null;
  entry.lastQuery = (new Date()).getTime();
  return entry.name;
}

setIntervalHandler(function() {
  var key, entry, now = (new Date()).getTime();
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

function updateTopology(top, name, fromnode, tonode) {
  top.nodes[fromnode] = fromnode;
  top.nodes[tonode] = tonode;
  top.edges[name] = {from:fromnode,to:tonode};
}

function getTopology(name) {
  var res = dump('TOPOLOGY',name);
  var top = {nodes:{}, edges:{}};
  for(var i = 0; i < res.length; i++) {
    let entry = res[i];
    let agent = entry.agent;
    let keys = entry.topKeys;
    for(var j = 0; j < keys.length; j++) {
      let [input,output,ttl] = keys[j].key.split(',');
      let link = topologyInterfaceToLink(agent,input);
      if(link) {
        updateTopology(top,link.linkname,link.remotenode,link.localnode);
      } else {
        let port = topologyInterfaceToPort(agent,input);
        if(port) {
          let pname = '>'+port.node+'-'+(port.port||input);
          updateTopology(top,pname,pname,port.node);
        }
      }
      link = topologyInterfaceToLink(agent,output);
      if(link) {
        updateTopology(top,link.linkname,link.localnode,link.remotenode);
      } else {
        let port = topologyInterfaceToPort(agent,output);
        if(port) {
          let pname = '<'+port.node+'-'+(port.port||output);
          updateTopology(top,pname,port.node,pname);
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
  
