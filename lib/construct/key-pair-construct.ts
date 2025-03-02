import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as cr from 'aws-cdk-lib/custom-resources'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import { Construct } from 'constructs'
import * as dotenv from 'dotenv'

dotenv.config()

export class KeyPairConstruct extends Construct {
  public readonly keyPairName: string
  public readonly keyPairSecret: secretsmanager.Secret

  constructor(scope: Construct, id: string) {
    super(scope, id)

    // Secrets Managerでシークレットを作成
    this.keyPairSecret = new secretsmanager.Secret(this, 'KeyPairSecret', {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'ec2-user' }),
        generateStringKey: 'private_key'
      }
    })

    // キーペアの作成
    const cfnKeyPair = new ec2.CfnKeyPair(this, 'MyCfnKeyPair', {
      keyName: process.env.KEY_PAIR_NAME || 'default-key-pair'
    })

    // カスタムリソースプロバイダーの作成
    const provider = new cr.Provider(this, 'KeyPairProvider', {
      onEventHandler: new cdk.aws_lambda.Function(this, 'KeyPairHandler', {
        runtime: cdk.aws_lambda.Runtime.NODEJS_18_X,
        handler: 'index.handler',
        code: cdk.aws_lambda.Code.fromInline(`
          const { SecretsManagerClient, PutSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
          const client = new SecretsManagerClient();
          
          exports.handler = async (event) => {
            console.log('Event:', JSON.stringify(event, null, 2));
            
            if (event.RequestType === 'Create') {
              const secretId = event.ResourceProperties.SecretId;
              const keyPair = event.ResourceProperties.KeyPair;
              
              try {
                const command = new PutSecretValueCommand({
                  SecretId: secretId,
                  SecretString: JSON.stringify({
                    private_key: keyPair,
                    key_name: event.ResourceProperties.KeyName,
                  }),
                });
                
                await client.send(command);
                console.log('Key pair saved to Secrets Manager');
              } catch (error) {
                console.error('Error:', error);
                throw error;
              }
            }
            
            return {
              PhysicalResourceId: event.LogicalResourceId,
              Data: {},
            };
          }
        `),
        environment: {
          REGION: cdk.Stack.of(this).region
        }
      })
    })

    // Lambda関数にSecretsManagerへのアクセス権限を付与
    this.keyPairSecret.grantWrite(provider.onEventHandler)

    // カスタムリソースの作成
    new cdk.CustomResource(this, 'KeyPairCustomResource', {
      serviceToken: provider.serviceToken,
      properties: {
        SecretId: this.keyPairSecret.secretArn,
        KeyName: cfnKeyPair.keyName
      }
    })

    this.keyPairName = cfnKeyPair.keyName
  }
}
