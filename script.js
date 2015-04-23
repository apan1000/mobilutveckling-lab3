$(function() {

  var isDirectionalChat = true;
  var oldDirection = "";
  var proxChannel = "";
  var pos = {};
  var compassHandler;
  // Grab the elements
  var header = $("#header");
  var input = $("#input");
  var sendBtn = $("#send-btn");
  var historyBtn = $("#history-btn");
  var output = $("#output");
  var directionDiv = $("#direction");
  var usernumberDiv = $("#user-number");
  var changeChatBtn = $("#change-chat-btn");

  // get/create/store username
  var username = PUBNUB.db.get('session') || (function(){ 
    var uuid = PUBNUB.uuid(); 
    PUBNUB.db.set('session', uuid); 
    return uuid; 
  })();

  // initiate pubnnub with username
  var pubnub = PUBNUB.init({
    publish_key   : "pub-c-c5851931-b8a6-414a-97c8-292c78141e1a",
    subscribe_key : "sub-c-7786f29c-e506-11e4-bb49-0619f8945a4f",
    origin        : 'pubsub.pubnub.com',
    ssl           : true,
    uuid          : username
  });
  console.log("username:",username);

  // Geohash!
  function geohash( coord, resolution ) { 
    var rez = Math.pow( 10, resolution || 0 );
    return Math.floor(coord * rez) / rez;
  }
  // Set current position
  function setPosition(position) {
    pos = position.coords;
    console.log(position);
    // Subscribe to proximity channel
    subscribeToProx();
  }

  function showLocationError(error) {
    switch(error.code) {
      case error.PERMISSION_DENIED:
        output.html("User denied the request for Geolocation.");
        break;
      case error.POSITION_UNAVAILABLE:
        output.html("Location information is unavailable.");
        break;
      case error.TIMEOUT:
        output.html("The request to get user location timed out.");
        break;
      case error.UNKNOWN_ERROR:
        output.html("An unknown error occurred.");
        break;
    }
  }

  // Starts chat in either directional mode or proximity mode
  var startChat = function() {
    // If we are in directional chat
    if (isDirectionalChat) {
      changeChatBtn.html("Local chat");

      if (proxChannel !== "") {
        // Unsubscribe from proximity channel
        pubnub.unsubscribe({
            channel: proxChannel,
         });
        // Unubscribe from proximity presence channel
        pubnub.unsubscribe({
          channel: proxChannel+'-pnpres',
          message: function(message) {console.log("unsubscribed from presence",message) }
        });
        output.html("");
      }

      // Get heading
      if (window.DeviceOrientationEvent) {
        // Listen for the deviceorientation event and handle the raw data
        window.addEventListener('deviceorientation', compassHandler = function(eventData) {
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
            header.removeClass(oldDirection).removeClass('local').addClass(direction);
            sendBtn.removeClass(oldDirection).removeClass('local').addClass(direction);
            directionDiv.html(direction);

            // Unsubscribe from oldDirection channel
            pubnub.unsubscribe({
                channel : oldDirection+'-chat',
             });
            // Unubscribe from old presence channel
            pubnub.unsubscribe({
              channel: oldDirection+'-chat-pnpres',
              message: function(message) {console.log("unsubscribed from presence",message) }
            });
            output.html("");

            // Subscribe to new direction to recieve messages
            pubnub.subscribe({
              channel   : direction+'-chat',
              timetoken : new Date().getTime(),
              presence: function(message) {
                console.log(message.occupancy);
                usernumberDiv.html("Users: " + message.occupancy);
                },
              callback  : function(message) {
                if (message.user === username) {
                  output.append('<div class="bubble my-bubble slide-from-right">' + message.text + '</div><br/>');
                } else {
                  output.append('<div class="bubble slide-from-left ' + direction + '">' + message.text + '</div><br/>');
                }
                $(document).scrollTop($(document).height());
              }
            });
            // Get channel history
            pubnub.history({
              count : 50,
              channel : direction+'-chat',
              callback : function (messages) {
                output.html("");
                $.each(messages[0], function(index, message){
                  if (message.user === username) {
                    output.append('<div class="bubble my-bubble slide-from-right">' + message.text + '</div><br/>');
                  } else if (!message.user) {
                    output.append('<div class="bubble slide-from-left ' + direction + '">' + message + '</div><br/>');
                  } else {
                    output.append('<div class="bubble slide-from-left ' + direction + '">' + message.text + '</div><br/>');
                  }
                });
                $(document).scrollTop($(document).height());
              }
            });

            // Subscribe to presence channel
            pubnub.subscribe({
              channel: direction+'-chat-pnpres',
              message: function(message) {
                console.log("president:",message.occupancy);
                usernumberDiv.html("Users: " + message.occupancy);
              }
            });

            sendBtn.unbind('click');
            // Send messages by clicking sendBtn
            sendBtn.on('click', function() {
              if (input.val() !== "") {
                pubnub.publish({
                  channel : direction+'-chat',
                  message : {
                    user: username,
                    text: input.val()
                  }
                });
                input.val("");
              }
            });

            input.unbind('keypress');
            // Send messages by clicking enter on input
            input.on('keypress', function(e) {
              if (input.val() !== "") {
                if (e.which === 13) {
                  pubnub.publish({
                    channel : direction+'-chat',
                    message : {
                      user: username,
                      text: input.val()
                    }
                  });
                  input.val(""); 
                }
              }
            });

            // Set new oldDirection
            oldDirection = direction;
          }
        });
      }
    }
    // If we are in proximity chat
    else {
      changeChatBtn.html("Directional chat");
      window.removeEventListener('deviceorientation', compassHandler);
      header.removeClass(oldDirection).addClass("local");
      sendBtn.removeClass(oldDirection).addClass("local");
      // Unsubscribe from oldDirection channel
      pubnub.unsubscribe({
          channel : oldDirection+'-chat',
       });
      // Unubscribe from old presence channel
      pubnub.unsubscribe({
        channel: oldDirection+'-chat-pnpres',
        message: function(message) {console.log("unsubscribed from presence",message) }
      });
      output.html("");
      oldDirection = ""; // Reset oldDirection

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(setPosition, showLocationError);
      } else {
        output.html("Geolocation is not supported by this browser.");
      }
    }
  }

  // Subscribe to proximity channel when position is set
  var subscribeToProx = function() {
    // Create Proximity Channel 
    proxChannel = geohash( pos.latitude, 0 ) + '' + geohash( pos.longitude, 0 );
    console.log("proxChannel:",proxChannel);

    directionDiv.html(proxChannel);

    // Subscribe to Proximity Channel
    pubnub.subscribe({
      channel : proxChannel,
      timetoken : new Date().getTime(),
      presence: function(message) {
        console.log(message.occupancy);
        usernumberDiv.html("Users: " + message.occupancy);
        },
      callback  : function(message) {
        if (message.user === username) {
          output.append('<div class="bubble my-bubble slide-from-right">' + message.text + '</div><br/>');
        } else {
          output.append('<div class="bubble slide-from-left local">' + message.text + '</div><br/>');
        }
        $(document).scrollTop($(document).height());
      }
    });
    // Get channel history
    pubnub.history({
      count : 50,
      channel : proxChannel,
      callback : function (messages) {
        output.html("");
        $.each(messages[0], function(index, message){
          if (message.user === username) {
            output.append('<div class="bubble my-bubble slide-from-right">' + message.text + '</div><br/>');
          } else if (!message.user) {
            output.append('<div class="bubble slide-from-left local">' + message + '</div><br/>');
          } else {
            output.append('<div class="bubble slide-from-left local">' + message.text + '</div><br/>');
          }
        });
        $(document).scrollTop($(document).height());
      }
    });
    // Subscribe to presence channel
    pubnub.subscribe({
      channel: proxChannel+'-pnpres',
      message: function(message) {
        console.log("president:",message.occupancy);
        usernumberDiv.html("Users: " + message.occupancy);
      }
    });

    sendBtn.unbind('click');
    // Send messages by clicking sendBtn
    sendBtn.on('click', function() {
      if (input.val() !== "") {
        pubnub.publish({
          channel : proxChannel,
          message : {
            user: username,
            text: input.val()
          }
        });
        input.val("");
      }
    });

    input.unbind('keypress');
    // Send messages by clicking enter on input
    input.on('keypress', function(e) {
      if (input.val() !== "") {
        if (e.which === 13) {
          pubnub.publish({
            channel : proxChannel,
            message : {
              user: username,
              text: input.val()
            }
          });
          input.val(""); 
        }
      }
    });
  }

  // Run startChat on load
  startChat();

  changeChatBtn.on('click', function() {
    isDirectionalChat = !isDirectionalChat;
    startChat(); 
  });
  
  

});


