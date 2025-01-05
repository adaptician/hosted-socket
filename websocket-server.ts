import * as amqp from 'amqplib'; // For RabbitMQ
import { WebSocketServer } from 'ws'; // For WebSocket Server

const rabbitmqUrl = 'amqp://localhost';
const exchangeName = 'cannon-test';
const websocketPort = 8080;

async function startWebSocketServer() {
    try {
        // Step 1: Connect to RabbitMQ
        const connection = await amqp.connect(rabbitmqUrl);
        console.log('Connected to RabbitMQ');
        const channel = await connection.createChannel();

        // Step 2: Assert the exchange and bind a queue
        await channel.assertExchange(exchangeName, 'fanout', { durable: true });
        const { queue } = await channel.assertQueue('cannonq', { exclusive: true });
        await channel.bindQueue(queue, exchangeName, '');

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
