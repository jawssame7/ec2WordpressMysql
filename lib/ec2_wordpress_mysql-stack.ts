import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { NetworkConstruct } from './construct/network-construct'
import { IAMConstruct } from './construct/iam-construct'
import { KeyPairConstruct } from './construct/key-pair-construct'
import { EC2Construct } from './construct/ec2-construct'

export class Ec2WordpressMysqlStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const network = new NetworkConstruct(this, 'NetworkConstruct')
    const iam = new IAMConstruct(this, 'IAMConstruct')
    // const keyPair = new KeyPairConstruct(this, 'KeyPairConstruct')
    const ec2Instance = new EC2Construct(this, 'EC2Construct', network, iam, undefined)

    new cdk.CfnOutput(this, 'InstancePublicIp', {
      value: ec2Instance.instance.instancePublicIp
    })
  }
}
