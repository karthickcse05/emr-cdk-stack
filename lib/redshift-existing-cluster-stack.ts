import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as redshift from 'aws-cdk-lib/aws-redshift';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';

export class MyRedshiftExisitngClusterStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const adminUserName = this.node.tryGetContext('adminUserName');
    const adminPassword = this.node.tryGetContext('adminPassword');
    const numberOfNodes = this.node.tryGetContext('numberOfNodes');
    const nodeType = this.node.tryGetContext('nodeType');
    const subnetGroupName = this.node.tryGetContext('subnetGroupName');
    const vpcId = this.node.tryGetContext('vpcId');
    const iamRoleArn = this.node.tryGetContext('iamRoleArn');
    const securityGroupId = this.node.tryGetContext('securityGroupId');
    const publicAccessible = this.node.tryGetContext('publicAccessible');
    const databaseName = this.node.tryGetContext('databaseName');
    const port = this.node.tryGetContext('port');
    const parameterGroupName = this.node.tryGetContext('defaultparameterGroupName');
    const kmsKeyId = this.node.tryGetContext('kmsKeyId');
    const automatedSnapshotRetentionPeriod = this.node.tryGetContext('automatedSnapshotRetentionPeriod');
    const manualSnapshotRetentionPeriod = this.node.tryGetContext('manualSnapshotRetentionPeriod');
    const enhancedVpcRouting = this.node.tryGetContext('enhancedVpcRouting');
    const snsTopicArn = this.node.tryGetContext('snsTopicArn');
    const alarmThreshold = this.node.tryGetContext('alarmThreshold');
    const availabilityZone = this.node.tryGetContext('availabilityZone');
    const maintenanceWindow = this.node.tryGetContext('maintenanceWindow');

    // Import existing VPC
    const vpc = ec2.Vpc.fromLookup(this, 'Vpc', {
      vpcId: vpcId
    });


    // Import existing IAM Role
    const redshiftRole = iam.Role.fromRoleArn(this, 'RedshiftRole', iamRoleArn);

    // Import existing Security Group
    const securityGroup = ec2.SecurityGroup.fromSecurityGroupId(this, 'SecurityGroup', securityGroupId);

    // Create the Redshift cluster
    const cluster = new redshift.CfnCluster(this, 'RedshiftCluster', {
      clusterType: numberOfNodes > 1 ? 'multi-node' : 'single-node',
      nodeType: nodeType,
      numberOfNodes: numberOfNodes,
      masterUsername: adminUserName,
      masterUserPassword: adminPassword,
      clusterSubnetGroupName:subnetGroupName,
      vpcSecurityGroupIds: [securityGroup.securityGroupId],
      publiclyAccessible: publicAccessible,
      dbName: databaseName,
      port: port,
      clusterParameterGroupName: parameterGroupName,
      encrypted: true,
      kmsKeyId: kmsKeyId,
      preferredMaintenanceWindow: maintenanceWindow, // Default maintenance window
      maintenanceTrackName: 'Trailing', // Maintenance track as Current
      automatedSnapshotRetentionPeriod: automatedSnapshotRetentionPeriod,
      manualSnapshotRetentionPeriod: manualSnapshotRetentionPeriod,
      enhancedVpcRouting: enhancedVpcRouting,
      iamRoles: [redshiftRole.roleArn],
      availabilityZoneRelocation: true, // Enable cluster relocation,
      availabilityZone: availabilityZone,
      multiAz:false,
      tags: [{
        key: 'org',
        value: 'testing',
      }],
    });

    

    // Create SNS topic
    const snsTopic = sns.Topic.fromTopicArn(this, 'SnsTopic', snsTopicArn);

    // Create CloudWatch alarm
    const alarm = new cloudwatch.Alarm(this, 'RedshiftAlarm', {
        metric: new cloudwatch.Metric({
          namespace: 'AWS/Redshift',
          metricName: 'CPUUtilization',
          dimensionsMap: {
            ClusterIdentifier: cluster.ref
          }
        }),
        threshold: alarmThreshold,
        evaluationPeriods: 1
      });
  
    alarm.addAlarmAction(new cloudwatch_actions.SnsAction(snsTopic));
    // Add SNS subscription
    //snsTopic.addSubscription(new sns_subscriptions.EmailSubscription('your-email@example.com'));

    
  }
}
