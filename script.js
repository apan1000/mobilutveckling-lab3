$(function() {

  var oldDirection = "";
  // Grab the elements
  var input = $("#input");
  var sendBtn = $("#send-btn");
  var historyBtn = $("#history-btn");
  var output = $("#output");
  var directionDiv = $("#direction");

  // Init PubNub
  var pubnub = PUBNUB.init({
    publish_key   : "pub-c-c5851931-b8a6-414a-97c8-292c78141e1a",
    subscribe_key : "sub-c-7786f29c-e506-11e4-bb49-0619f8945a4f"
  });

  // Get heading
  if (window.DeviceOrientationEvent) {
    // Listen for the deviceorientation event and handle the raw data
    window.addEventListener('deviceorientation', function(eventData) {
      var compassdir;
      if(event.webkitCompassHeading) {
        // Apple works only with this, alpha doesn't work
        compassdir = event.webkitCompassHeading;
      } else {
        compassdir = event.alpha;
      }

      if (compassdir >= 315 || compassdir < 45) {
        var direction = "north";
      }
      else if (compassdir >= 45 && compassdir < 135) {
        if(event.webkitCompassHeading) {
          var direction = "east";
        } else {
          var direction = "west";
        }
      }
      else if (compassdir >= 135 && compassdir < 225) {
        var direction = "south";
      }
      else {
        if(event.webkitCompassHeading) {
          var direction = "west";
        } else {
          var direction = "east";
        }
      }

      // If direction has changed
      if (direction !== oldDirection) {
        directionDiv.html("Heading: " + direction);

        // Unsubscribe from oldDirection channel
        pubnub.unsubscribe({
            channel : oldDirection+'-chat',
         });
        output.html("");
        // Subscribe to new direction to recieve messages
        pubnub.subscribe({
          channel   : direction+'-chat',
          timetoken : new Date().getTime(),
          presence: function(m){console.log(m)},
          callback  : function(message) {
            output.append('<br />' + message);
          }
        });

        pubnub.history({
          count : 10,
          channel : direction+'-chat',
          callback : function (message) {
            output.append(message[0].join("<br />"))
          }
        });

        // Subscribe to presence channel
        pubnub.subscribe({
          channel: direction+'-chat-pnpres',
          message: function(message) {console.log(message) }
        });

        sendBtn.unbind('click');
        // send messages
        sendBtn.on('click', function() {
          pubnub.publish({
            channel : direction+'-chat',
            message : input.val()
          });
          input.val("");  
        });

        historyBtn.unbind('click');
        // check history
        historyBtn.on('click', function() {
          output.html("");
          pubnub.history({
            count : 10,
            channel : direction+'-chat',
            callback : function (message) {
              output.append(message[0].join("<br />"))
            }
          });
        });

        // Set new oldDirection
        oldDirection = direction;
      }
    });
  }

});


