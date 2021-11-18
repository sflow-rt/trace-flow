$(function() {
  var keysURL  = '../scripts/trace.js/flowkeys/json';
  var traceURL = '../scripts/trace.js/trace/json';

  $('a[href="#"]').on('click', function(e) {
    e.preventDefault();
  });

  var filter;
  var search = window.location.search;
  if(search) {
    search.substring(1).split('&').forEach(function(el) {
      var pair = el.split('=');
      if(pair.length === 2) {
        if('filter' === decodeURIComponent(pair[0])) {
          filter = decodeURIComponent(pair[1]);
        }
      }
    });
  }
  if(filter) {
    window.sessionStorage.setItem('trace_flow_filter', filter);
  } else {
    filter = window.sessionStorage.getItem('trace_flow_filter') || '';
  }

  var nodes = new vis.DataSet([]);
  var edges = new vis.DataSet([]);

  var container = document.getElementById('trace');

  var data = {nodes:nodes, edges:edges};
  var options = {
    physics: {solver:'repulsion'}
  };
  var network = new vis.Network(container, data, options);

  function updateTrace(data) {
    var node, edge, entry, ids, i;
    if(!data.nodes || !data.edges) return;
    for(node in data.nodes) {
      entry = data.nodes[node];
      if(!nodes.get(node)) nodes.add({id:node,label:entry.label||node,shape:entry.port?'box':'ellipse'}); 
    }
    for(edge in data.edges) {
      entry = data.edges[edge]; 
      if(!edges.get(edge)) edges.add({id:edge,label:entry.label||edge,from:entry.from,to:entry.to,arrows:entry.bidirectional?'to;from':'to'});
      else {
        var arrows = 'to';
        if(entry.bidirectional) arrows = 'to;from';
        else if(entry.from !== edges.get(edge).from) arrows = 'from';
        if(arrows !== edges.get(edge).arrows) {
          edges.update({id:edge,arrows:arrows});
        }
      }
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
        if(running_trace) {
          updateTrace({nodes:{},edges:{}});
          timeout_trace = setTimeout(pollTrace, 5000);
        }
      }
    });
  }

  function stopPollTrace() {
    running_trace = false;
    if(timeout_trace) clearTimeout(timeout_trace);
  }

  function split(str,pat) {
    var re = new RegExp(pat,'g');
    var end = 0;
    while(re.test(str)) { end = re.lastIndex; }
    return [ str.substring(0,end), str.substring(end) ];
  }

  var sep_filter = '[&|(]';
  function filterSuggestions(q, sync, async) {
    var parts = split(q,sep_filter);
    var prefix = parts[0];
    var suffix = parts[1]; 
    $.getJSON(keysURL, { search: suffix }, function(suggestedToken) {
      if(suggestedToken.length === 1 && suggestedToken[0] === suffix) return;
      var suggestions = [];
      for (var i = 0; i < suggestedToken.length; i++) {
        suggestions.push(prefix + suggestedToken[i]);
      }
      async(suggestions); 
    });
  }

  $('#filter')
    .val(filter)
    .typeahead(
      {
        highlight: true,
        minLength: 0
      },
      {
        name: 'filter',
        source: filterSuggestions,
        limit: 200,
        display: (a) => split(a,sep_filter)[1]
      }
    )
    .bind('typeahead:active', function() {
      this.scrollLeft = this.scrollWidth;
      var input = this;
      setTimeout(function() { input.setSelectionRange(1000,1000); }, 1);
    })
    .bind('typeahead:cursorchange', function(evt,suggestion) {
      $(this).typeahead('val',$(this).typeahead('val'));
      this.scrollLeft = this.scrollWidth;
    })
    .bind('typeahead:autocomplete', function(evt,suggestion) {
      $(this).typeahead('val',suggestion + '=');
      this.scrollLeft = this.scrollWidth;
    })
    .bind('typeahead:select', function(evt,suggestion) {
      $(this).typeahead('val',suggestion + '=');
      this.scrollLeft = this.scrollWidth;
    });

  $('#reset').click(function() {
    $('#filter').typeahead('val','');
    filter = '';
    window.sessionStorage.setItem('trace_flow_filter', filter);
    window.history.replaceState({},'','index.html');
    stopPollTrace();
    updateTrace({nodes:{},edges:{}});   
  });

  $('#submit').click(function() {
    stopPollTrace();
    filter = $.trim($('#filter').typeahead('val'));
    window.sessionStorage.setItem('trace_flow_filter', filter);
    window.history.replaceState({},'','index.html?filter='+encodeURIComponent(filter));
    pollTrace();
  });

  if(filter) pollTrace();
});
