(function(){
  var expose = ExposeClient();
  var html;

  expose.expose("update", function(html){
    document.body.innerHTML = html;
  });

  setInterval(function(){
    var newHtml = document.body.innerHTML;
    if (newHtml!==html) {
      expose.withServerApi(function(api){
        api.update(newHtml);
      });
    }
    html = newHtml;
  }, 1000);

  expose.start("localhost", 8080);
})();
