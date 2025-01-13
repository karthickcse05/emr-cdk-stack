import * as cdk from 'aws-cdk-lib';
import * as redshift from 'aws-cdk-lib/aws-redshift';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions   from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as kms from 'aws-cdk-lib/aws-kms';

export class RedshiftClusterStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const adminUserName = this.node.tryGetContext('adminUserName');
    const adminPassword = this.node.tryGetContext('adminPassword');
    const numberOfNodes = this.node.tryGetContext('numberOfNodes');
    const nodeType = this.node.tryGetContext('nodeType');
    const subnets = this.node.tryGetContext('subnets');
    const availabilityZone = this.node.tryGetContext('availabilityZone');
    const publicAccessible = this.node.tryGetContext('publicAccessible');
    const databaseName = this.node.tryGetContext('databaseName');
    const port = this.node.tryGetContext('port');
    const parameterGroupName = this.node.tryGetContext('parameterGroupName');
    const maintenanceWindow = this.node.tryGetContext('maintenanceWindow');
    const automatedSnapshotRetentionPeriod = this.node.tryGetContext('automatedSnapshotRetentionPeriod');
    const enhancedVpcRouting = this.node.tryGetContext('enhancedVpcRouting');
    const securityGroupId = this.node.tryGetContext('securityGroupId');
    const parameterGroupFamily = this.node.tryGetContext('parameterGroupFamily');
    const parameters = this.node.tryGetContext('parameters');
    const kmsKeyId = this.node.tryGetContext('kmsKeyId');
    const manualSnapshotRetentionPeriod = this.node.tryGetContext('manualSnapshotRetentionPeriod');
    const snsTopicArn = this.node.tryGetContext('snsTopicArn');
    const alarmThreshold = this.node.tryGetContext('alarmThreshold');


    // Create a subnet group
    const subnetGroup = new redshift.CfnClusterSubnetGroup(this, 'RedshiftSubnetGroup', {
      description: 'Redshift subnet group',
      subnetIds: subnets,
      tags: [{
        key: 'Name',
        value: 'SubNetGroup',
      }],
    });


    // Create an IAM role for Redshift
    const redshiftRole = new iam.Role(this, 'RedshiftRole', {
      assumedBy: new iam.ServicePrincipal('redshift.amazonaws.com')
    });

    // Attach policies to the role
    redshiftRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess'));
     
    
    
    // Import existing Security Group
    const securityGroup = ec2.SecurityGroup.fromSecurityGroupId(this, 'SecurityGroup', securityGroupId);

    // Create a Redshift parameter group
    const parameterGroup = new redshift.CfnClusterParameterGroup(this, 'ParameterGroup', {
           description: 'Redshift parameter group',
           parameterGroupFamily: parameterGroupFamily,
           parameters: parameters,
           parameterGroupName: parameterGroupName
        });

      
    // Create the Redshift cluster
    const cluster = new redshift.CfnCluster(this, 'RedshiftCluster', {
        clusterType: numberOfNodes > 1 ? 'multi-node' : 'single-node',
        nodeType: nodeType,
        numberOfNodes: numberOfNodes,
        masterUsername: adminUserName,
        masterUserPassword: adminPassword,
        clusterSubnetGroupName:subnetGroup.attrClusterSubnetGroupName,
        vpcSecurityGroupIds: [securityGroup.securityGroupId],
        publiclyAccessible: publicAccessible,
        dbName: databaseName,
        port: port,
        clusterParameterGroupName: parameterGroup.ref,
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
        key: 'purpose',
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
