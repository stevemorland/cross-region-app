import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as route53 from 'aws-cdk-lib/aws-route53'; 
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as certificate_manager from 'aws-cdk-lib/aws-certificatemanager'
import * as path from 'path';

interface ExtendedProps extends cdk.StackProps {
  region: string;
  stackName: string;
  domainName: string;
  certId: string;
  hostedZoneId: string;
  target: route53.GeoLocation;
}

export class CrossRegionAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ExtendedProps) {
    super(scope, id, props);

    const certificateArn = `arn:aws:acm:${props.region}:${this.account}:certificate/${props.certId}`;
    const domainCert = certificate_manager.Certificate.fromCertificateArn(this, 'domainCert', certificateArn);
    
    const lambdaFunction = new lambda.Function(this, 'lambda-function', {
      functionName: `${props.stackName}-fuction`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.main',
      code: lambda.Code.fromAsset(path.join(__dirname, '/../src')),
      environment: {
        REGION: props.region
      }
    });

    const api = new apigateway.LambdaRestApi(this, 'api', {
      handler: lambdaFunction,
      proxy: false,
      domainName: {
        domainName: props.domainName,
        certificate: domainCert,
        }
    });
        
    const rootIntegration = api.root.addResource('hello');
    rootIntegration.addMethod('GET');

    const zone = route53.HostedZone.fromHostedZoneAttributes(this, "hostedZone", {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.domainName
    });

    new route53.ARecord(this, "aliasRecord", {
      recordName: props.domainName,
      target: route53.RecordTarget.fromAlias(
        new targets.ApiGateway(api)
      ),
      zone,
      geoLocation: props.target,

    });
  }
}
