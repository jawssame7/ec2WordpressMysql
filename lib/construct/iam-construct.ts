import { Construct } from 'constructs'
import * as iam from 'aws-cdk-lib/aws-iam'

export class IAMConstruct extends Construct {
  public readonly role: iam.Role

  constructor(scope: Construct, id: string) {
    super(scope, id)

    this.role = new iam.Role(this, 'Ec2InstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
    })

    this.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'))
  }
}
