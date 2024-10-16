import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as emr from 'aws-cdk-lib/aws-emr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export class MyEmrCDKClusterStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Read values from context
    const vpcId = this.node.tryGetContext('vpcId');
    const emrRoleArn = this.node.tryGetContext('emrRoleArn');
    const autoScalingRoleArn = this.node.tryGetContext('autoScalingRoleArn');
    const instanceProfileArn = this.node.tryGetContext('instanceProfileArn');

    // Import the existing VPC
    const vpc = ec2.Vpc.fromLookup(this, 'ImportedVPC', {
        vpcId: vpcId
      });

    // Create a VPC
    // const vpc = new ec2.Vpc(this, 'MyVpc', {
    //   maxAzs: 2
    // });


    // Import the existing IAM Role
    //const emrRole = iam.Role.fromRoleArn(this, 'ImportedEMRRole', emrRoleArn);

    // Create an EMR Service Role
    const emrRole = new iam.Role(this, 'EMRRole', {
      assumedBy: new iam.ServicePrincipal('elasticmapreduce.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonElasticMapReduceRole')
      ]
    });

    // Create an Instance Profile for EC2 instances in the EMR cluster
    const instanceProfile = new iam.CfnInstanceProfile(this, 'InstanceProfile', {
      roles: [emrRole.roleName]
    });

    // Import the existing Auto Scaling Role
    //const autoScalingRole = iam.Role.fromRoleArn(this, 'AutoScalingRole', autoScalingRoleArn);

    // Create an Auto Scaling Role
    const autoScalingRole = new iam.Role(this, 'AutoScalingRole', {
      assumedBy: new iam.ServicePrincipal('elasticmapreduce.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonElasticMapReduceforAutoScalingRole')
      ]
    });

    // Define bootstrap actions
    const bootstrapActions: emr.CfnCluster.BootstrapActionConfigProperty[] = [
      {
        name: 'SSSD EMR-AD integration',
        scriptBootstrapAction: {
          path: 's3://abh-bss-WDSC-dev-emr-bootstrap/updated_bootstrap/configure_sssd_BA_wrapper_v12_cfam.sh',
          args: []
        }
      },
      {
        name: 'Create HDSFS home dir',
        scriptBootstrapAction: {
          path: 's3://abh-bss-WDSC-dev-emr-bootstrap/updated_bootstrap/create-hdfs-home-ba.sh',
          args: ['arg1', 'arg2']
        }
      }
    ];

    // Define configurations
    const cluster_configurations: emr.CfnCluster.ConfigurationProperty[] = [
      {
        classification: 'core-site',
        configurationProperties: {
            "hadoop.security.auth_to_local": "RULE:[1:$1@$0](.*TY\\.LOCAL)s/@.*///L RULE:[2:$1@$0](.*TY\\.LOCAL)s/@.*///L DEFAULT",
            "hadoop.security.token.service.use_ip": "true"
        }     
      },
      {
        classification: 'hadoop-kms-site',
        configurationProperties: {
            "hadoop.kms.authentication.kerberos.name.rules": "RULE:[1:$1@$0](.*TY\\.LOCAL)s/@.*///L RULE:[2:$1@$0](.*TY\\.LOCAL)s/@.*///L DEFAULT"
        }
      },
      {
        classification: 'spark-defaults',
        configurationProperties: {
            "spark.local.dir": "/mnt/tmp"
        }
      },
      {
        classification: 'yarn-site',
        configurationProperties: {
            "yarn.nodemanager.localizer.cache.cleanup.interval-ms": "200000",
            "yarn.nodemanager.localizer.cache.target-size-mb": "5120"
        }
      }
    ];

    // Define managed scaling policy
    const cluster_managedscalingPolicy: emr.CfnCluster.ManagedScalingPolicyProperty = {
        computeLimits:{
            minimumCapacityUnits:3,
            maximumCapacityUnits:30,
            maximumCoreCapacityUnits:30,
            maximumOnDemandCapacityUnits:30,
            unitType:"Instances"
        }
    }

    // Define instance group
    const cluster_instances: emr.CfnCluster.JobFlowInstancesConfigProperty = {
        masterInstanceGroup: {
          name:'Master - 1',
          instanceCount: 1,
          instanceType: 'r5.8xlarge',
          ebsConfiguration:{
            ebsBlockDeviceConfigs:[
                {
                  volumeSpecification:{
                    volumeType:"gp2",
                    sizeInGb:1000
                  },
                  volumesPerInstance:1
                }
            ]
          }
        },
        coreInstanceGroup: {
          name:'Core - 2',
          instanceCount: 1,
          instanceType: 'r5.8xlarge',
          ebsConfiguration:{
            ebsBlockDeviceConfigs:[
                {
                  volumeSpecification:{
                    volumeType:"gp2",
                    sizeInGb:1000
                  },
                  volumesPerInstance:1
                }
            ]
          }
        },
        taskInstanceGroups:[
            {
            name:'Task_r5.8xlarge_SPOT_By_Managed_Scaling',
            instanceCount: 1,
            instanceType: 'r5.8xlarge',
            ebsConfiguration:{
              ebsBlockDeviceConfigs:[
                  {
                    volumeSpecification:{
                      volumeType:"gp2",
                      sizeInGb:128
                    },
                    volumesPerInstance:1
                  }
              ]
            }
          },
          {
            name:'Task - 2',
            instanceCount: 1,
            instanceType: 'r5.8xlarge',
            ebsConfiguration:{
              ebsBlockDeviceConfigs:[
                  {
                    volumeSpecification:{
                      volumeType:"gp2",
                      sizeInGb:256
                    },
                    volumesPerInstance:1
                  }
              ]
            }
          }
        ],
        ec2SubnetId: vpc.publicSubnets[0].subnetId,
        terminationProtected:false,
        emrManagedMasterSecurityGroup:"sg-0474c8308fce359d2",
        emrManagedSlaveSecurityGroup:"sg-08b214bcca7d0ea2e",
        ec2KeyName:"abh-bss-WDSC-DEV-key",
        additionalMasterSecurityGroups:["sg-0023359ba986bf58c","sg-0f73a2ac0656b661c"],
        additionalSlaveSecurityGroups:["sg-0023359ba986bf58c","sg-0c1fde48917ec4e3f"],
        serviceAccessSecurityGroup:"sg-0fbf4048d03f3f412"
      }

      // Define tags
    const emr_tags: cdk.CfnTag[] = [
        { key: 'BusinessUnit', value: 'cfam' },
        { key: 'SEID', value: 'A-IR-00-bssWDSC@@@@@@@@-SSPEIOS682-R00748-H-P' }
      ];

    // Define the EMR Cluster
    new emr.CfnCluster(this, 'MyEmrCluster', {
      name: 'MY-EMR-2024 - 6.9',
      releaseLabel: 'emr-6.9.0',
      logUri:"s3://my-emr-logs",
      applications: [
        { name: 'Hadoop' },
        { name: 'Livy' },
        { name: 'Spark ' },
        { name: 'TensorFlow  ' }
      ],
      configurations: cluster_configurations,
      instances: cluster_instances,
      kerberosAttributes: {
        realm: 'EMR.WDSC',
        kdcAdminPassword: '',
        crossRealmTrustPrincipalPassword: '',
        adDomainJoinUser: ''
      },
      managedScalingPolicy:cluster_managedscalingPolicy,
      securityConfiguration: 'EMR_v2',
      bootstrapActions: bootstrapActions,
      autoScalingRole: autoScalingRole.roleArn,
      scaleDownBehavior: 'TERMINATE_AT_TASK_COMPLETION',
      serviceRole: emrRole.roleArn,
      jobFlowRole: instanceProfile.attrArn,
      ebsRootVolumeSize: 75,
      tags:emr_tags
    });
  }
}
