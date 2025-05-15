const express = require('express');
const { Sequelize, Model, DataTypes } = require('sequelize');
const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' });

const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite'
});

class Order extends Model {}
Order.init({
  user_id: DataTypes.INTEGER,
  product: DataTypes.STRING,
  quantity: DataTypes.INTEGER
}, { sequelize, modelName: 'order' });

sequelize.sync();

const init = () => {
  const app = express();

  middleware(app);
  endpoints(app);
  listenSqs();

  app.listen(3000, () => {
    console.log('Listening on port 3000');
  });
};

const middleware = (app) => {
  app.use(express.json());
  app.use(express.urlencoded({extended: false}));
};

const endpoints = (app) => {
  app.get('/orders', async (req, res) => {
    const orders = await Order.findAll();
    res.json(orders);
  });

  app.get('/orders/:id', async (req, res) => {
    const order = await Order.findByPk(req.params.id);
    res.json(order);
  });

  app.post('/orders', async (req, res) => {
    const { user_id, product, quantity } = req.body;
    if (!user_id || !product || !quantity) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const order = await Order.create({ user_id, product, quantity });
    res.json(order);
  });

  app.put('/orders/:id', async (req, res) => {
    const order = await Order.findByPk(req.params.id);
    if (order) {
      await order.update(req.body);
      res.json(user);
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  });

  app.delete('/orders/:id', async (req, res) => {
    const order = await Order.findByPk(req.params.id);
    if (order) {
      await user.destroy();
      res.json({ message: 'Order deleted' });
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  });
};

const listenSqs = () => {
  const params = {
    AttributeNames: ['SentTimestamp'],
    MaxNumberOfMessages: 10,
    MessageAttributeNames: ['All'],
    QueueUrl: '',
    VisibilityTimeout: 20,
    WaitTimeSeconds: 0,
  };

  const interval = setInterval(() => {
    sqs.receiveMessage(params, (err, data) => {
      if (err) {
        console.error('Error receiving message', err);
      } else if (data.Messages) {
        data.Messages.forEach(async (message) => {
          const order = JSON.parse(message.Body);
          await Order.create(order);

          const deleteParams = {
            QueueUrl: params.QueueUrl,
            ReceiptHandle: message.ReceiptHandle
          };
          sqs.deleteMessage(deleteParams, (err, data) => {
            if (err) {
              console.error('Error deleting message', err);
            } else {
              console.log('Message deleted', data);
            }
          });
        });
      }
    });
  }, 5000);

  clearInterval(interval);
};

init();