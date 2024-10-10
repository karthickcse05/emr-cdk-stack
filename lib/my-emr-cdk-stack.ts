import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as emr from 'aws-cdk-lib/aws-emr';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';

export class MyEmrCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Read values from context
    const vpcId = this.node.tryGetContext('vpcId');
    const emrRoleArn = this.node.tryGetContext('emrRoleArn');
    const instanceProfileArn = this.node.tryGetContext('instanceProfileArn');

    // Import the existing VPC
    const vpc = ec2.Vpc.fromLookup(this, 'ImportedVPC', {
      vpcId: vpcId
    });

    // Import the existing IAM Role
    //const emrRole = iam.Role.fromRoleArn(this, 'ImportedEMRRole', emrRoleArn);

    // Create a VPC
    // const vpc = new ec2.Vpc(this, 'MyVpc', {
    //   maxAzs: 2 // Default is all AZs in the region
    // });

    // Create an EMR cluster role
    const emrRole = new iam.Role(this, 'EMRRole', {
      roleName:'oct10-emr',
      assumedBy: new iam.ServicePrincipal('elasticmapreduce.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonElasticMapReduceRole')
      ]
    });

    // Create an instance profile for the EMR cluster
    const instanceProfile = new iam.CfnInstanceProfile(this, 'InstanceProfile', {
      roles: [emrRole.roleName]
    });

    // Create an EMR cluster
    const cluster = new emr.CfnCluster(this, 'MyEMRCluster', {
      instances: {
        masterInstanceGroup: {
          instanceCount: 1,
          instanceType: 'm5.xlarge',
          market: 'ON_DEMAND'
        },
        coreInstanceGroup: {
          instanceCount: 2,
          instanceType: 'm5.xlarge',
          market: 'ON_DEMAND'
        },
        ec2SubnetId: vpc.publicSubnets[0].subnetId
      },
      jobFlowRole: instanceProfile.ref,
      name: 'MyEMRCluster',
      serviceRole: emrRole.roleArn,
      releaseLabel: 'emr-6.3.0',
      applications: [
        { name: 'Hadoop' },
        { name: 'Spark' }
      ]
    });
  }
}

