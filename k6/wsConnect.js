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
    const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getRandomToken()}`,
    }
    const channel_id = getRandomChannel()
    const resp = http.get(`${ServerURL}/api/v4/channels/${channel_id}/posts?per_page=10`, {headers})
    check(resp, {
        'Get status is 200': (r) => resp.status === 200,
    });
    const res = ws.connect(url, null, function (socket) {
    socket.on('open', () => {
      console.log('connected');
      socket.send('k6 send hello');
    });

    socket.on('message', (data) => {
      console.log('Message received: ', data);
      check(data, {
        'message is not empty': (d) => d !== '',
      });
    });

    socket.on('close', () => {
      console.log('disconnected');
    });

    socket.on('error', (e) => {
      console.error('WebSocket error:', e.error());
    });
  });
  
  check(res, { 'status is 101': (r) => r && r.status === 101 });
}
