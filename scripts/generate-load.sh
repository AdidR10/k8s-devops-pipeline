#!/bin/bash
# usage: ./generate-load.sh <node-ip>
NODE_IP=$1
while true; do
  curl -s "http://$NODE_IP:30080/api/products" > /dev/null
  curl -s "http://$NODE_IP:30080/api/orders" > /dev/null
  sleep 0.2
done