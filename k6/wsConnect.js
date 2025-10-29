import {check} from 'k6';
import http from 'k6/http';
import ws from 'k6/ws';

const config = JSON.parse(open('../config/config.json'));
const creds = JSON.parse(open('../temp_store.json'));

export var options = {};
const {RPS, Executor, Duration, Rate, TimeUnit, VirtualUserCount} = config.LoadTestConfiguration;
const {ServerURL} = config.ConnectionConfiguration;
const {MaxWordsCount, MaxWordLength} = config.PostsConfiguration;

if (RPS) {
    options = {
        discardResponseBodies: true,
        scenarios: {
            contacts: {
                executor: Executor,
                duration: Duration,
                rate: Rate,
                timeUnit: TimeUnit,
                preAllocatedVUs: VirtualUserCount,
            },
        }
    }
} else {
    options = {
        vus: VirtualUserCount,
        duration: Duration,
    }
}

export function setup() {
	if (MaxWordsCount <= 0) {
        console.error("Error in validating the posts configuration:", "max word count should be greater than 0");
		return;
	}

	if (MaxWordLength <= 0) {
        console.error("Error in validating the posts configuration:", "max word length should be greater than 0");
		return;
	}
}

function getRandomToken() {
    let tokens = [];
    creds.UserResponse.map((u) => tokens.push(u.token));
    return tokens[(Math.floor(Math.random() * tokens.length))];
}

function getRandomChannel() {
    let channelIds = [];
    creds.ChannelResponse.map((c) => channelIds.push(c.id));
    if (creds.DMResponse) {
        channelIds.push(creds.DMResponse.id);
    }

    if (creds.GMResponse) {
        channelIds.push(creds.GMResponse.id);
    }

    return channelIds[(Math.floor(Math.random() * channelIds.length))];
}

export default function() {

    const url = 'wss://chat.testkontur.ru/';
    const params = { tags: { my_tag: 'my ws session' } };
    const user = `user_${__VU}`;

    const res = ws.connect(url, params, function (socket) {
        socket.on('open', function open() {
          console.log(`VU ${__VU}: connected`);
          socket.send(JSON.stringify({ msg: 'Hello!', user: user }));
          socket.setInterval(function timeout() {
            socket.send(
                JSON.stringify({
                    user: user,
                    msg: `I'm saying ${randomString(5)}`,
                    foo: 'bar',
          })
        );
      }, randomIntBetween(1000, 2000)); // say something every 1-2 seconds
    });

    socket.on('pong', function () {
      console.log('PONG!');
    });

    socket.on('close', function () {
      console.log(`VU ${__VU}: disconnected`);
    });

    socket.on('message', function (message) {
      const data = JSON.parse(message);
      console.log(`VU ${__VU} received message: ${data.msg}`);
    });

    socket.setTimeout(function () {
      console.log(`VU ${__VU}: ${sessionDuration}ms passed, leaving the website`);
      socket.send(JSON.stringify({ msg: 'Goodbye!', user: user }));
    }, sessionDuration);    
    
    socket.setTimeout(function () {
      console.log(`Closing the socket forcefully 3s after graceful LEAVE`);
      socket.close();
    }, sessionDuration + 3000);    
    });
    
    check(res, { 'Connected successfully': (r) => r && r.status === 101 });
    sleep(1);
}
