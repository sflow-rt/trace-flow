$(function() {
  var keysURL  = '../scripts/trace.js/flowkeys/json';
  var traceURL = '../scripts/trace.js/trace/json';

  var nodes, edges, network, filter='';

  function updateTrace(data) {
    var node, edge, entry, ids, i;
    if(!data.nodes || !data.edges) return;
    for(node in data.nodes) {
      if(!nodes.get(node)) nodes.add({id:node,label:node}); 
    }
    for(edge in data.edges) {
      entry = data.edges[edge]; 
      if(!edges.get(edge)) edges.add({id:edge,label:edge,from:entry.from,to:entry.to});
    }
    ids = nodes.getIds();
    for(i = 0; i < ids.length; i++) {
      if(!data.nodes[ids[i]]) nodes.remove({id:ids[i]});
    }
    ids = edges.getIds();
    for(i = 0; i < ids.length; i++) {
      if(!data.edges[ids[i]]) edges.remove({id:ids[i]});
    }
  }

  var running_trace;
  var timeout_trace;
  function pollTrace() {
    if(!filter) return;

    running_trace = true;
    var query = {filter:filter};
    $.ajax({
      url: traceURL,
      data: query,
      success: function(data) {
        if(running_trace) {
          updateTrace(data);
          timeout_trace = setTimeout(pollTrace, 1000);
        }
      },
      error: function(result,status,errorThrown) {
        if(running_trace) timeout_trace = setTimeout(pollTrace, 5000);
      }
    });
  }

  function stopPollTrace() {
    running_trace = false;
    if(timeout_trace) clearTimeout(timeout_trace);
  }

  $('#filter')
    .val(filter)
    .bind("keydown", function(event) {
      if (event.keyCode === $.ui.keyCode.TAB &&
        $(this).autocomplete("instance").menu.active ) {
          event.preventDefault();
        }
    })
    .autocomplete({
      minLength: 0,
      source: function( request, response) {
        $.getJSON(keysURL, { search: request.term.split(/[&|(]\s*/).pop() }, response)
      },
      focus: function() {
        // prevent value inserted on focus
        return false;
      },
      select: function(event, ui) {
        var val = this.value;
        var re = /[&|(]/g;
        var end = 0;
        while(re.test(val)) { end = re.lastIndex; }
        this.value = val.substring(0,end) + ui.item.value + "=";
        return false;
      }
    })
    .focus(function() { $(this).autocomplete('search'); });

  $('#cleardef').button({icons:{primary:'ui-icon-cancel'},text:false}).click(function() {
    $('#filter').val('');
    filter = '';
    stopPollTrace();
  });
  $('#submitdef').button({icons:{primary:'ui-icon-check'},text:false}).click(function() {
    stopPollTrace();
    filter = $.trim($('#filter').val());
    pollTrace();
  });

  nodes = new vis.DataSet([]);
  edges = new vis.DataSet([]);

  var container = document.getElementById('trace');

  var data = {nodes:nodes, edges:edges};
  var options = {
    physics: {solver:'repulsion'},
    edges: {arrows:'to'}
  }; 
  network = new vis.Network(container, data, options);   
});
