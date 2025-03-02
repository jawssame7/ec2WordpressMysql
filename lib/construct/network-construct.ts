import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as dotenv from 'dotenv'

// .env の読み込み
dotenv.config()

export class NetworkConstruct extends Construct {
  public readonly vpc: ec2.Vpc
  public readonly securityGroup: ec2.SecurityGroup

  constructor(scope: Construct, id: string) {
    super(scope, id)

    const vpcName = process.env.VPC_NAME || 'default-vpc'

    // VPC を作成
    this.vpc = new ec2.Vpc(this, 'MyVPC', {
      vpcName: vpcName,
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC
        },
        {
          cidrMask: 24,
          name: 'PrivateSubnet',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
        }
      ]
    })

    // セキュリティグループを作成
    this.securityGroup = new ec2.SecurityGroup(this, 'MySecurityGroup', {
      vpc: this.vpc,
      description: 'Allow SSH, HTTP, and MySQL',
      allowAllOutbound: true
    })

    this.securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'Allow SSH')
    this.securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP')
    this.securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(3306), 'Allow MySQL')
  }
}
