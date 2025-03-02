#!/bin/bash
exec > >(tee /var/log/user-data.log | logger -t user-data -s 2>/dev/console) 2>&1

# パッケージの更新
dnf update -y
dnf install -y httpd php php-mysqlnd php-fpm wget unzip
dnf -y install https://dev.mysql.com/get/mysql84-community-release-el9-1.noarch.rpm
dnf -y install mysql mysql-community-client mysql-community-server

# サービスの有効化
systemctl enable httpd
systemctl start httpd
systemctl enable mysqld
systemctl start mysqld

# MySQL 初期セットアップ
sleep 10
TEMP_PASSWORD=$(grep 'temporary password' /var/log/mysqld.log | awk '{print $NF}')

# 一時的な MySQL 設定ファイルを作成
echo "[client]
user=root
password=${TEMP_PASSWORD}" > /root/.my.cnf
chmod 600 /root/.my.cnf

# パスワード変更 & 初期セットアップ
mysql --connect-expired-password <<EOF
ALTER USER 'root'@'localhost' IDENTIFIED BY 'StrongRootPass123!';
UNINSTALL COMPONENT 'file://component_validate_password';
CREATE DATABASE wordpress;
CREATE USER 'wp_user'@'localhost' IDENTIFIED BY 'WpPass123!';
GRANT ALL PRIVILEGES ON wordpress.* TO 'wp_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
EOF

# 設定ファイルを削除（セキュリティ対策）
rm -f /root/.my.cnf

# WordPress のダウンロード & 設定
cd /var/www/html
wget https://wordpress.org/latest.tar.gz
tar -xzf latest.tar.gz
chown -R apache:apache wordpress
chmod -R 755 wordpress
cp wordpress/wp-config-sample.php wordpress/wp-config.php
sed -i "s/database_name_here/wordpress/" wordpress/wp-config.php
sed -i "s/username_here/wp_user/" wordpress/wp-config.php
sed -i "s/password_here/WpPass123!/" wordpress/wp-config.php

# Apache 再起動
systemctl restart httpd
echo "UserData script completed"
