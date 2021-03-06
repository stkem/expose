(function(){
  var expose = ExposeClient({port: 8080});
  var html;

  expose.exports.update = function(html){
    document.body.innerHTML = html;
  };

  setInterval(function(){
    var newHtml = document.body.innerHTML;
    if (newHtml!==html) {
      expose.withServerApi(function(api){
        api.update(newHtml);
      });
    }
    html = newHtml;
  }, 1000);

  expose.start();
})();
