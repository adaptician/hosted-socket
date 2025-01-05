import * as amqp from 'amqplib'; // For RabbitMQ
import { WebSocketServer } from 'ws'; // For WebSocket Server

const rabbitmqUrl = 'amqp://localhost';
const exchangeName = 'universe';
const websocketPort = 8080;

// TODO:T in order to avoid the hard-coded exchange and make deployment far more powerful,
// you could expose endpoints to start and stop the server.
// The start endpoint could accept the exchange name as a parameter.
// This way, a socket server could be spun up per simulation node, 
// but it will wait for the monocle to stage
// for this to work as a proper test, the worldId will come from panorama - 
// we need to be able to capture this from monocle so that we can view and existing world. 

async function startWebSocketServer() {
    try {
        // Step 1: Connect to RabbitMQ
        const connection = await amqp.connect(rabbitmqUrl);
        console.log('Connected to RabbitMQ');
        const channel = await connection.createChannel();

        // Step 2: Assert the exchange and bind a queue
        await channel.assertExchange(exchangeName, 'topic', { durable: true });

        // Create a temporary queue to bind to the exchange.
        const { queue } = await channel.assertQueue('socket', { exclusive: true });
        
        // Listen to everything for this websocket server.
        await channel.bindQueue(queue, exchangeName, '#');

        console.log(`Queue "${queue}" bound to exchange "${exchangeName}"`);

        // Step 3: Start the WebSocket Server
        const wss = new WebSocketServer({ port: websocketPort });
        console.log(`WebSocket server running on ws://localhost:${websocketPort}`);

        // Step 4: Handle WebSocket connections
        wss.on('connection', (ws) => {
            console.log('WebSocket client connected');

            // Step 5: Consume messages from RabbitMQ
            channel.consume(
                queue,
                (msg) => {
                    if (msg?.content) {
                        const message = msg.content.toString();
                        console.log(`RabbitMQ message received: ${message}`);
                        ws.send(message); // Send the message to the WebSocket client
                    }
                },
                { noAck: true }
            );

            // Handle WebSocket client disconnection
            ws.on('close', () => {
                console.log('WebSocket client disconnected');
            });
        });
    } catch (error) {
        console.error('Error:', error);
    }
}

// Start the server
startWebSocketServer();
