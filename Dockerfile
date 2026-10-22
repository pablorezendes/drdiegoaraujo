FROM nginx:stable-alpine

RUN rm -f /usr/share/nginx/html/index.html /usr/share/nginx/html/50x.html
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY maintenance/ /usr/share/nginx/html/

EXPOSE 80
