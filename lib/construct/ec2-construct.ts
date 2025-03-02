import * as cdk from 'aws-cdk-lib'
import * as fs from 'fs'
import { Construct } from 'constructs'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as dotenv from 'dotenv'
import { IAMConstruct } from './iam-construct'
import { NetworkConstruct } from './network-construct'
import { KeyPairConstruct } from './key-pair-construct'

// .env の読み込み
dotenv.config()

export class EC2Construct extends Construct {
  public readonly instance: ec2.Instance

  constructor(
    scope: Construct,
    id: string,
    network: NetworkConstruct,
    iam: IAMConstruct,
    keyPair: KeyPairConstruct | undefined
  ) {
    super(scope, id)

    const ami = ec2.MachineImage.latestAmazonLinux2023()

    const mysqlRootPassword = process.env.MYSQL_ROOT_PASSWORD || 'DefaultRootPass!'
    const wordpressDbName = process.env.WORDPRESS_DB_NAME || 'wordpress'
    const wordpressUser = process.env.WORDPRESS_DB_USER || 'wp_user'
    const wordpressPassword = process.env.WORDPRESS_DB_PASSWORD || 'WpPass123!'
    const keyName = process.env.KEY_PAIR_NAME || 'default-key-pair'

    const instance = new ec2.Instance(this, 'MyInstance', {
      vpc: network.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC
      },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: ami,
      securityGroup: network.securityGroup,
      role: iam.role,
      keyName: keyName
    })

    // // 外部スクリプトを読み込む
    // const userDataScript = fs.readFileSync('ec2userdata/user-data.sh', 'utf8')
    // instance.addUserData(userDataScript)

    // `user-data.sh` の内容を作成
    const userDataContent = `#!/bin/bash
exec > >(tee /var/log/user-data.log | logger -t user-data -s 2>/dev/console) 2>&1

# パッケージの更新
dnf update -y
dnf install -y httpd php php-mysqlnd php-fpm wget unzip mod_ssl certbot python3-certbot-apache
dnf -y install https://dev.mysql.com/get/mysql84-community-release-el9-1.noarch.rpm
dnf -y install mysql mysql-community-client mysql-community-server

# サービスの有効化
systemctl enable httpd
systemctl start httpd
systemctl enable mysqld
systemctl start mysqld

# MySQL の一時パスワードを取得
sleep 10
TEMP_PASSWORD=$(grep 'temporary password' /var/log/mysqld.log | awk '{print $NF}')

# .my.cnf を作成し、一時的に MySQL の自動ログインを設定
echo "[client]
user=root
password=\${TEMP_PASSWORD}
" > /root/.my.cnf
chmod 600 /root/.my.cnf

# MySQL 初期設定
mysql --connect-expired-password -u root -p"\${TEMP_PASSWORD}" <<EOF
ALTER USER 'root'@'localhost' IDENTIFIED BY '${mysqlRootPassword}';
UNINSTALL COMPONENT 'file://component_validate_password';
CREATE DATABASE ${wordpressDbName};
CREATE USER '${wordpressUser}'@'localhost' IDENTIFIED BY '${wordpressPassword}';
GRANT ALL PRIVILEGES ON ${wordpressDbName}.* TO '${wordpressUser}'@'localhost';
FLUSH PRIVILEGES;
EXIT;
EOF

# .my.cnf を削除（セキュリティ対策）
rm -f /root/.my.cnf

# WordPress のダウンロード & 設定
cd /var/www/html
wget https://wordpress.org/latest.tar.gz
tar -xzf latest.tar.gz
chown -R apache:apache wordpress
chmod -R 755 wordpress
cp wordpress/wp-config-sample.php wordpress/wp-config.php
sed -i "s/database_name_here/${wordpressDbName}/" wordpress/wp-config.php
sed -i "s/username_here/${wordpressUser}/" wordpress/wp-config.php
sed -i "s/password_here/${wordpressPassword}/" wordpress/wp-config.php

# Apache 再起動
systemctl restart httpd
echo "UserData script completed"
`
    instance.addUserData(userDataContent)
    this.instance = instance
  }
}
