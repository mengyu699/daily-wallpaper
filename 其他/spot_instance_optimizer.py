import boto3
import json
import time
import random
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple
from dataclasses import dataclass
import statistics

@dataclass
class WorkloadSuitability:
    workload_name: str
    workload_type: str
    interruption_tolerance: str  # 'high', 'medium', 'low'
    stateless: bool
    fault_tolerant: bool
    checkpointing_capable: bool
    time_flexible: bool
    suitability_score: float
    estimated_savings: float

@dataclass
class SpotRecommendation:
    workload_name: str
    strategy: str
    instance_types: List[str]
    allocation_strategy: str
    target_capacity: int
    on_demand_percentage: int
    spot_percentage: int
    estimated_monthly_savings: float
    risk_level: str
    implementation_complexity: str

class SpotInstanceOptimizer:
    def __init__(self):
        self.ec2 = boto3.client('ec2')
        self.autoscaling = boto3.client('autoscaling')
        self.ecs = boto3.client('ecs')
        self.cloudwatch = boto3.client('cloudwatch')
        
        # Spot pricing history and availability data
        self.spot_advisor_data = self._init_spot_advisor()
        
        # Instance family characteristics for spot optimization
        self.instance_characteristics = {
            't3': {'interruption_rate': 'low', 'cost_savings': 0.70, 'availability': 'high'},
            'm5': {'interruption_rate': 'medium', 'cost_savings': 0.75, 'availability': 'high'},
            'c5': {'interruption_rate': 'medium', 'cost_savings': 0.70, 'availability': 'medium'},
            'r5': {'interruption_rate': 'medium', 'cost_savings': 0.65, 'availability': 'medium'},
            'i3': {'interruption_rate': 'high', 'cost_savings': 0.80, 'availability': 'low'},
            'x1': {'interruption_rate': 'high', 'cost_savings': 0.85, 'availability': 'low'}
        }
    
    def _init_spot_advisor(self):
        """Initialize spot advisor with historical data"""
        # In a real implementation, this would fetch from AWS Spot Advisor API
        return {
            'interruption_rates': {
                'm5.large': {'frequency': '<5%', 'score': 0},
                'm5.xlarge': {'frequency': '5-10%', 'score': 1},
                'c5.large': {'frequency': '10-15%', 'score': 2},
                'c5.xlarge': {'frequency': '15-20%', 'score': 3},
                'r5.large': {'frequency': '5-10%', 'score': 1},
                't3.medium': {'frequency': '<5%', 'score': 0},
                't3.large': {'frequency': '<5%', 'score': 0}
            },
            'savings_rates': {
                'm5.large': 0.72,
                'm5.xlarge': 0.68,
                'c5.large': 0.75,
                'c5.xlarge': 0.70,
                'r5.large': 0.65,
                't3.medium': 0.70,
                't3.large': 0.68
            }
        }
    
    def identify_spot_opportunities(self):
        """Identify workloads suitable for spot instances"""
        print("Analyzing workloads for spot instance opportunities...")
        
        workloads = self._analyze_workloads()
        
        spot_candidates = {
            'batch_processing': [],
            'dev_test': [],
            'stateless_apps': [],
            'ci_cd': [],
            'data_processing': [],
            'containerized_apps': []
        }
        
        for workload in workloads:
            suitability = self._assess_spot_suitability(workload)
            
            if suitability.suitability_score > 0.6:  # Suitable for spot
                category = suitability.workload_type
                
                recommendation = SpotRecommendation(
                    workload_name=suitability.workload_name,
                    strategy=self._recommend_spot_strategy(suitability),
                    instance_types=self._recommend_instance_types(workload),
                    allocation_strategy=self._recommend_allocation_strategy(suitability),
                    target_capacity=workload.get('target_capacity', 10),
                    on_demand_percentage=self._calculate_on_demand_percentage(suitability),
                    spot_percentage=100 - self._calculate_on_demand_percentage(suitability),
                    estimated_monthly_savings=suitability.estimated_savings,
                    risk_level=self._assess_risk_level(suitability),
                    implementation_complexity=self._assess_implementation_complexity(suitability)
                )
                
                spot_candidates[category].append(recommendation)
        
        return spot_candidates
    
    def _analyze_workloads(self) -> List[Dict]:
        """Analyze current workloads to identify spot candidates"""
        workloads = []
        
        # Analyze EC2 instances
        workloads.extend(self._analyze_ec2_workloads())
        
        # Analyze Auto Scaling Groups
        workloads.extend(self._analyze_asg_workloads())
        
        # Analyze ECS services
        workloads.extend(self._analyze_ecs_workloads())
        
        return workloads
    
    def _analyze_ec2_workloads(self) -> List[Dict]:
        """Analyze EC2 instances for spot suitability"""
        workloads = []
        
        try:
            # Get running instances
            response = self.ec2.describe_instances(
                Filters=[{'Name': 'instance-state-name', 'Values': ['running']}]
            )
            
            for reservation in response['Reservations']:
                for instance in reservation['Instances']:
                    # Analyze instance characteristics
                    workload = {
                        'name': instance['InstanceId'],
                        'type': 'ec2_instance',
                        'instance_type': instance['InstanceType'],
                        'launch_time': instance['LaunchTime'],
                        'vpc_id': instance.get('VpcId'),
                        'subnet_id': instance.get('SubnetId'),
                        'security_groups': [sg['GroupId'] for sg in instance.get('SecurityGroups', [])],
                        'tags': {tag['Key']: tag['Value'] for tag in instance.get('Tags', [])},
                        'target_capacity': 1,
                        'current_cost': self._estimate_instance_cost(instance['InstanceType']),
                        'uptime_pattern': self._analyze_uptime_pattern(instance['InstanceId'])
                    }
                    workloads.append(workload)
                    
        except Exception as e:
            print(f"Error analyzing EC2 workloads: {e}")
        
        return workloads
    
    def _analyze_asg_workloads(self) -> List[Dict]:
        """Analyze Auto Scaling Groups for spot suitability"""
        workloads = []
        
        try:
            response = self.autoscaling.describe_auto_scaling_groups()
            
            for asg in response['AutoScalingGroups']:
                if asg['DesiredCapacity'] > 0:
                    workload = {
                        'name': asg['AutoScalingGroupName'],
                        'type': 'auto_scaling_group',
                        'desired_capacity': asg['DesiredCapacity'],
                        'min_size': asg['MinSize'],
                        'max_size': asg['MaxSize'],
                        'instance_types': self._get_asg_instance_types(asg),
                        'availability_zones': asg['AvailabilityZones'],
                        'tags': {tag['Key']: tag['Value'] for tag in asg.get('Tags', [])},
                        'target_capacity': asg['DesiredCapacity'],
                        'current_cost': self._estimate_asg_cost(asg),
                        'scaling_pattern': self._analyze_scaling_pattern(asg['AutoScalingGroupName'])
                    }
                    workloads.append(workload)
                    
        except Exception as e:
            print(f"Error analyzing ASG workloads: {e}")
        
        return workloads
    
    def _analyze_ecs_workloads(self) -> List[Dict]:
        """Analyze ECS services for spot suitability"""
        workloads = []
        
        try:
            # Get ECS clusters
            clusters_response = self.ecs.list_clusters()
            
            for cluster_arn in clusters_response['clusterArns']:
                cluster_name = cluster_arn.split('/')[-1]
                
                # Get services in cluster
                services_response = self.ecs.list_services(cluster=cluster_arn)
                
                for service_arn in services_response['serviceArns']:
                    service_name = service_arn.split('/')[-1]
                    
                    # Get service details
                    service_details = self.ecs.describe_services(
                        cluster=cluster_arn,
                        services=[service_arn]
                    )['services'][0]
                    
                    if service_details['status'] == 'ACTIVE':
                        workload = {
                            'name': f"{cluster_name}/{service_name}",
                            'type': 'ecs_service',
                            'cluster': cluster_name,
                            'service_name': service_name,
                            'desired_count': service_details['desiredCount'],
                            'running_count': service_details['runningCount'],
                            'launch_type': service_details.get('launchType', 'EC2'),
                            'platform_version': service_details.get('platformVersion'),
                            'target_capacity': service_details['desiredCount'],
                            'current_cost': self._estimate_ecs_cost(service_details),
                            'task_definition': service_details['taskDefinition']
                        }
                        workloads.append(workload)
                        
        except Exception as e:
            print(f"Error analyzing ECS workloads: {e}")
        
        return workloads
    
    def _assess_spot_suitability(self, workload: Dict) -> WorkloadSuitability:
        """Assess how suitable a workload is for spot instances"""
        
        # Extract workload characteristics
        workload_name = workload['name']
        workload_type = self._classify_workload_type(workload)
        
        # Assess various factors
        interruption_tolerance = self._assess_interruption_tolerance(workload)
        stateless = self._is_stateless(workload)
        fault_tolerant = self._is_fault_tolerant(workload)
        checkpointing_capable = self._has_checkpointing(workload)
        time_flexible = self._is_time_flexible(workload)
        
        # Calculate suitability score
        score = 0.0
        
        # Base score from interruption tolerance
        if interruption_tolerance == 'high':
            score += 0.4
        elif interruption_tolerance == 'medium':
            score += 0.2
        
        # Additional factors
        if stateless:
            score += 0.2
        if fault_tolerant:
            score += 0.15
        if checkpointing_capable:
            score += 0.15
        if time_flexible:
            score += 0.1
        
        # Estimate savings
        current_cost = workload.get('current_cost', 100)
        estimated_savings = current_cost * 0.7  # Average 70% savings
        
        return WorkloadSuitability(
            workload_name=workload_name,
            workload_type=workload_type,
            interruption_tolerance=interruption_tolerance,
            stateless=stateless,
            fault_tolerant=fault_tolerant,
            checkpointing_capable=checkpointing_capable,
            time_flexible=time_flexible,
            suitability_score=min(score, 1.0),
            estimated_savings=estimated_savings
        )
    
    def _classify_workload_type(self, workload: Dict) -> str:
        """Classify workload type based on characteristics"""
        tags = workload.get('tags', {})
        name = workload['name'].lower()
        
        # Check tags first
        if 'environment' in tags:
            env = tags['environment'].lower()
            if env in ['dev', 'test', 'staging']:
                return 'dev_test'
        
        # Check name patterns
        if any(keyword in name for keyword in ['batch', 'job', 'worker']):
            return 'batch_processing'
        elif any(keyword in name for keyword in ['ci', 'cd', 'build', 'jenkins']):
            return 'ci_cd'
        elif any(keyword in name for keyword in ['data', 'etl', 'spark', 'hadoop']):
            return 'data_processing'
        elif workload.get('type') == 'ecs_service':
            return 'containerized_apps'
        elif any(keyword in name for keyword in ['web', 'api', 'service']):
            return 'stateless_apps'
        
        return 'general'
    
    def _assess_interruption_tolerance(self, workload: Dict) -> str:
        """Assess how well workload can handle interruptions"""
        workload_type = self._classify_workload_type(workload)
        
        # High tolerance workload types
        if workload_type in ['batch_processing', 'ci_cd', 'data_processing']:
            return 'high'
        
        # Medium tolerance
        elif workload_type in ['dev_test', 'containerized_apps']:
            return 'medium'
        
        # Check for specific patterns
        tags = workload.get('tags', {})
        if tags.get('spot-suitable', '').lower() == 'true':
            return 'high'
        
        # Default to low tolerance for production workloads
        if tags.get('environment', '').lower() == 'prod':
            return 'low'
        
        return 'medium'
    
    def _is_stateless(self, workload: Dict) -> bool:
        """Check if workload is stateless"""
        workload_type = self._classify_workload_type(workload)
        
        # Generally stateless types
        stateless_types = ['batch_processing', 'ci_cd', 'data_processing', 'containerized_apps']
        
        if workload_type in stateless_types:
            return True
        
        # Check for stateless indicators in tags or name
        tags = workload.get('tags', {})
        name = workload['name'].lower()
        
        if 'stateless' in tags.get('architecture', '').lower():
            return True
        
        if any(keyword in name for keyword in ['worker', 'processor', 'lambda']):
            return True
        
        return False
    
    def _is_fault_tolerant(self, workload: Dict) -> bool:
        """Check if workload is fault tolerant"""
        workload_type = self._classify_workload_type(workload)
        
        # Types that are typically fault tolerant
        if workload_type in ['batch_processing', 'data_processing']:
            return True
        
        # Check for fault tolerance indicators
        if workload.get('type') == 'auto_scaling_group':
            # ASGs with multiple instances are generally fault tolerant
            return workload.get('desired_capacity', 1) > 1
        
        return False
    
    def _has_checkpointing(self, workload: Dict) -> bool:
        """Check if workload supports checkpointing"""
        workload_type = self._classify_workload_type(workload)
        
        # Types that commonly support checkpointing
        if workload_type in ['batch_processing', 'data_processing', 'ci_cd']:
            return True
        
        return False
    
    def _is_time_flexible(self, workload: Dict) -> bool:
        """Check if workload has time flexibility"""
        workload_type = self._classify_workload_type(workload)
        
        # Types that are typically time flexible
        return workload_type in ['batch_processing', 'data_processing', 'ci_cd']
    
    def _recommend_spot_strategy(self, suitability: WorkloadSuitability) -> str:
        """Recommend spot instance strategy"""
        if suitability.interruption_tolerance == 'high':
            return 'spot_only_diversified'
        elif suitability.interruption_tolerance == 'medium':
            return 'mixed_instances'
        else:
            return 'spot_with_fallback'
    
    def _recommend_instance_types(self, workload: Dict) -> List[str]:
        """Recommend instance types for spot optimization"""
        current_instance_type = workload.get('instance_type')
        
        if current_instance_type:
            # Find similar instance types for diversification
            family = current_instance_type.split('.')[0]
            size = current_instance_type.split('.')[1]
            
            # Recommend multiple instance types for diversification
            similar_types = []
            
            # Same family, different sizes
            if size == 'large':
                similar_types.extend([f"{family}.medium", f"{family}.large", f"{family}.xlarge"])
            elif size == 'xlarge':
                similar_types.extend([f"{family}.large", f"{family}.xlarge", f"{family}.2xlarge"])
            
            # Different families, similar performance
            if family in ['m5', 'm4']:
                similar_types.extend(['m5.large', 'm4.large', 'c5.large'])
            elif family in ['c5', 'c4']:
                similar_types.extend(['c5.large', 'c4.large', 'm5.large'])
            
            return list(set(similar_types))[:4]  # Max 4 instance types
        
        # Default recommendation
        return ['m5.large', 'c5.large', 'm4.large', 'c4.large']
    
    def _recommend_allocation_strategy(self, suitability: WorkloadSuitability) -> str:
        """Recommend spot allocation strategy"""
        if suitability.interruption_tolerance == 'high':
            return 'lowest-price'  # Maximize savings
        else:
            return 'capacity-optimized'  # Minimize interruptions
    
    def _calculate_on_demand_percentage(self, suitability: WorkloadSuitability) -> int:
        """Calculate recommended on-demand percentage"""
        if suitability.interruption_tolerance == 'high':
            return 0  # 100% spot
        elif suitability.interruption_tolerance == 'medium':
            return 20  # 80% spot
        else:
            return 50  # 50% spot
    
    def _assess_risk_level(self, suitability: WorkloadSuitability) -> str:
        """Assess overall risk level of spot migration"""
        if suitability.suitability_score > 0.8:
            return 'low'
        elif suitability.suitability_score > 0.6:
            return 'medium'
        else:
            return 'high'
    
    def _assess_implementation_complexity(self, suitability: WorkloadSuitability) -> str:
        """Assess implementation complexity"""
        if suitability.stateless and suitability.fault_tolerant:
            return 'low'
        elif suitability.interruption_tolerance == 'high':
            return 'medium'
        else:
            return 'high'
    
    def create_spot_fleet_configuration(self, recommendation: SpotRecommendation) -> Dict:
        """Create spot fleet configuration"""
        config = {
            'SpotFleetRequestConfig': {
                'IamFleetRole': 'arn:aws:iam::123456789012:role/aws-ec2-spot-fleet-role',
                'AllocationStrategy': recommendation.allocation_strategy,
                'TargetCapacity': recommendation.target_capacity,
                'SpotPrice': '0.50',  # Maximum price per hour
                'LaunchSpecifications': [],
                'TerminateInstancesWithExpiration': True,
                'Type': 'maintain'
            }
        }
        
        # Create launch specifications for each instance type
        for instance_type in recommendation.instance_types:
            launch_spec = {
                'ImageId': 'ami-12345678',  # Would be dynamically determined
                'InstanceType': instance_type,
                'KeyName': 'my-key-pair',
                'SecurityGroups': [{'GroupId': 'sg-12345678'}],
                'SubnetId': 'subnet-12345678',
                'UserData': self._generate_spot_user_data(recommendation),
                'WeightedCapacity': 1,
                'SpotPrice': str(self._get_max_spot_price(instance_type))
            }
            config['SpotFleetRequestConfig']['LaunchSpecifications'].append(launch_spec)
        
        return config
    
    def _generate_spot_user_data(self, recommendation: SpotRecommendation) -> str:
        """Generate user data for spot instances"""
        user_data_script = f'''#!/bin/bash
        
        # Spot instance interruption handler
        /opt/aws/bin/spot-instance-handler.sh &
        
        # Install and start application based on workload type
        if [[ "{recommendation.workload_name}" == *"batch"* ]]; then
            # Setup for batch processing
            aws s3 cp s3://my-bucket/batch-scripts/ /opt/batch/ --recursive
            chmod +x /opt/batch/*
            /opt/batch/start-batch-processor.sh
        elif [[ "{recommendation.workload_name}" == *"web"* ]]; then
            # Setup for web applications
            docker pull my-web-app:latest
            docker run -d -p 80:80 my-web-app:latest
        fi
        
        # Setup CloudWatch monitoring
        /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \\
            -a fetch-config -m ec2 -s -c file:/opt/aws/amazon-cloudwatch-agent/etc/cloudwatch-config.json
        '''
        
        import base64
        return base64.b64encode(user_data_script.encode()).decode()
    
    def _get_max_spot_price(self, instance_type: str) -> float:
        """Get maximum spot price for instance type"""
        # In practice, this would be based on current on-demand pricing
        on_demand_prices = {
            'm5.large': 0.096,
            'm5.xlarge': 0.192,
            'c5.large': 0.085,
            'c5.xlarge': 0.17,
            'r5.large': 0.126,
            't3.medium': 0.0416,
            't3.large': 0.0832
        }
        
        on_demand_price = on_demand_prices.get(instance_type, 0.10)
        return round(on_demand_price * 0.8, 4)  # 80% of on-demand as max bid
    
    def implement_spot_interruption_handling(self):
        """Create spot interruption handling system"""
        return {
            'lambda_function': self._create_interruption_handler_lambda(),
            'cloudwatch_event': self._create_spot_interruption_event(),
            'sns_notifications': self._create_spot_notification_system(),
            'graceful_shutdown_script': self._create_graceful_shutdown_script()
        }
    
    def _create_interruption_handler_lambda(self) -> Dict:
        """Create Lambda function for handling spot interruptions"""
        lambda_code = '''
import json
import boto3
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    """Handle spot instance interruption events"""
    
    ec2 = boto3.client('ec2')
    sns = boto3.client('sns')
    
    # Parse the interruption event
    detail = event['detail']
    instance_id = detail['instance-id']
    instance_action = detail['instance-action']
    
    logger.info(f"Handling spot interruption for {instance_id}: {instance_action}")
    
    try:
        # Get instance details
        response = ec2.describe_instances(InstanceIds=[instance_id])
        instance = response['Reservations'][0]['Instances'][0]
        
        # Trigger graceful shutdown
        if instance_action == 'terminate':
            trigger_graceful_shutdown(instance_id, instance)
        
        # Send notification
        send_interruption_notification(instance_id, instance_action, instance)
        
        return {
            'statusCode': 200,
            'body': json.dumps(f'Successfully handled interruption for {instance_id}')
        }
        
    except Exception as e:
        logger.error(f"Error handling spot interruption: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps(f'Error: {str(e)}')
        }

def trigger_graceful_shutdown(instance_id, instance):
    """Trigger graceful shutdown process"""
    ssm = boto3.client('ssm')
    
    # Send shutdown command via SSM
    ssm.send_command(
        InstanceIds=[instance_id],
        DocumentName='AWS-RunShellScript',
        Parameters={
            'commands': [
                '/opt/spot/graceful-shutdown.sh'
            ]
        },
        TimeoutSeconds=30
    )

def send_interruption_notification(instance_id, action, instance):
    """Send SNS notification about interruption"""
    sns = boto3.client('sns')
    
    message = {
        'instance_id': instance_id,
        'action': action,
        'instance_type': instance['InstanceType'],
        'availability_zone': instance['Placement']['AvailabilityZone'],
        'timestamp': datetime.utcnow().isoformat()
    }
    
    sns.publish(
        TopicArn='arn:aws:sns:us-east-1:123456789012:spot-interruptions',
        Subject=f'Spot Instance Interruption: {instance_id}',
        Message=json.dumps(message, indent=2)
    )
'''
        
        return {
            'FunctionName': 'spot-interruption-handler',
            'Runtime': 'python3.9',
            'Handler': 'lambda_function.lambda_handler',
            'Code': {'ZipFile': lambda_code},
            'Role': 'arn:aws:iam::123456789012:role/lambda-spot-handler-role',
            'Environment': {
                'Variables': {
                    'SNS_TOPIC_ARN': 'arn:aws:sns:us-east-1:123456789012:spot-interruptions'
                }
            }
        }
    
    def _create_graceful_shutdown_script(self) -> str:
        """Create graceful shutdown script for spot instances"""
        return '''#!/bin/bash
        
# Graceful shutdown script for spot instances
LOG_FILE="/var/log/spot-shutdown.log"
echo "$(date): Spot instance interruption detected" >> $LOG_FILE

# Function to save application state
save_application_state() {
    echo "$(date): Saving application state..." >> $LOG_FILE
    
    # Stop application services gracefully
    if systemctl is-active --quiet my-app; then
        systemctl stop my-app
        echo "$(date): Application stopped" >> $LOG_FILE
    fi
    
    # Save any in-memory data
    if [[ -f /opt/app/save-state.sh ]]; then
        /opt/app/save-state.sh
        echo "$(date): Application state saved" >> $LOG_FILE
    fi
    
    # Upload logs and data to S3
    aws s3 sync /var/log/ s3://my-backup-bucket/logs/$(curl -s http://169.254.169.254/latest/meta-data/instance-id)/
    aws s3 sync /opt/app/data/ s3://my-backup-bucket/data/$(curl -s http://169.254.169.254/latest/meta-data/instance-id)/
    
    echo "$(date): Data backed up to S3" >> $LOG_FILE
}

# Function to deregister from load balancers
deregister_from_load_balancer() {
    INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
    
    # Get all target groups this instance is registered with
    TARGET_GROUPS=$(aws elbv2 describe-target-health --query "TargetHealthDescriptions[?Target.Id=='$INSTANCE_ID'].{TargetGroupArn:TargetGroupArn}" --output text)
    
    for TG_ARN in $TARGET_GROUPS; do
        aws elbv2 deregister-targets --target-group-arn $TG_ARN --targets Id=$INSTANCE_ID
        echo "$(date): Deregistered from target group $TG_ARN" >> $LOG_FILE
    done
}

# Function to notify other services
notify_services() {
    INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
    
    # Send notification to SQS queue for other services to handle
    aws sqs send-message \\
        --queue-url https://sqs.us-east-1.amazonaws.com/123456789012/spot-interruption-queue \\
        --message-body "{\"instance_id\":\"$INSTANCE_ID\",\"action\":\"terminating\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
    
    echo "$(date): Sent notification to SQS" >> $LOG_FILE
}

# Main execution
echo "$(date): Starting graceful shutdown process" >> $LOG_FILE

# Execute shutdown procedures
deregister_from_load_balancer
save_application_state  
notify_services

# Wait a bit for final processing
sleep 10

echo "$(date): Graceful shutdown complete" >> $LOG_FILE

# Final sync of logs
aws s3 cp $LOG_FILE s3://my-backup-bucket/logs/$(curl -s http://169.254.169.254/latest/meta-data/instance-id)/spot-shutdown.log
'''
    
    def generate_spot_optimization_report(self, opportunities: Dict) -> str:
        """Generate comprehensive spot optimization report"""
        report = []
        report.append("=" * 70)
        report.append("SPOT INSTANCE OPTIMIZATION REPORT")
        report.append("=" * 70)
        report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("")
        
        # Summary
        total_opportunities = sum(len(recs) for recs in opportunities.values())
        total_savings = sum(
            sum(rec.estimated_monthly_savings for rec in recs)
            for recs in opportunities.values()
        )
        
        report.append("EXECUTIVE SUMMARY")
        report.append("-" * 17)
        report.append(f"Total Spot Opportunities: {total_opportunities}")
        report.append(f"Estimated Monthly Savings: ${total_savings:,.0f}")
        report.append(f"Average Savings per Workload: ${total_savings/total_opportunities:,.0f}" if total_opportunities > 0 else "N/A")
        report.append("")
        
        # Breakdown by category
        for category, recommendations in opportunities.items():
            if recommendations:
                report.append(f"{category.upper().replace('_', ' ')}")
                report.append("-" * len(category))
                
                category_savings = sum(rec.estimated_monthly_savings for rec in recommendations)
                report.append(f"Opportunities: {len(recommendations)}")
                report.append(f"Category Savings: ${category_savings:,.0f}/month")
                report.append("")
                
                # Top recommendations in category
                sorted_recs = sorted(recommendations, key=lambda x: x.estimated_monthly_savings, reverse=True)
                for i, rec in enumerate(sorted_recs[:3], 1):  # Top 3
                    report.append(f"  {i}. {rec.workload_name}")
                    report.append(f"     Strategy: {rec.strategy}")
                    report.append(f"     Spot/On-Demand: {rec.spot_percentage}%/{rec.on_demand_percentage}%")
                    report.append(f"     Monthly Savings: ${rec.estimated_monthly_savings:,.0f}")
                    report.append(f"     Risk Level: {rec.risk_level}")
                    report.append("")
        
        # Implementation roadmap
        report.append("IMPLEMENTATION ROADMAP")
        report.append("-" * 22)
        
        all_recs = []
        for recs in opportunities.values():
            all_recs.extend(recs)
        
        # Sort by implementation complexity and savings
        sorted_by_complexity = sorted(all_recs, 
                                    key=lambda x: (x.implementation_complexity, -x.estimated_monthly_savings))
        
        report.append("Phase 1 - Low Complexity (Immediate)")
        low_complexity = [r for r in sorted_by_complexity if r.implementation_complexity == 'low'][:5]
        for rec in low_complexity:
            report.append(f"  • {rec.workload_name} - ${rec.estimated_monthly_savings:,.0f}/month")
        
        report.append("\nPhase 2 - Medium Complexity (1-2 weeks)")
        medium_complexity = [r for r in sorted_by_complexity if r.implementation_complexity == 'medium'][:5]
        for rec in medium_complexity:
            report.append(f"  • {rec.workload_name} - ${rec.estimated_monthly_savings:,.0f}/month")
        
        report.append("\nPhase 3 - High Complexity (1-2 months)")
        high_complexity = [r for r in sorted_by_complexity if r.implementation_complexity == 'high'][:3]
        for rec in high_complexity:
            report.append(f"  • {rec.workload_name} - ${rec.estimated_monthly_savings:,.0f}/month")
        
        report.append("")
        report.append("=" * 70)
        
        return "\n".join(report)
    
    # Helper methods for cost estimation
    def _estimate_instance_cost(self, instance_type: str) -> float:
        """Estimate monthly cost of instance"""
        hourly_rates = {
            't3.micro': 0.0104, 't3.small': 0.0208, 't3.medium': 0.0416,
            't3.large': 0.0832, 't3.xlarge': 0.1664,
            'm5.large': 0.096, 'm5.xlarge': 0.192, 'm5.2xlarge': 0.384,
            'c5.large': 0.085, 'c5.xlarge': 0.17, 'c5.2xlarge': 0.34,
            'r5.large': 0.126, 'r5.xlarge': 0.252
        }
        
        hourly_rate = hourly_rates.get(instance_type, 0.10)
        return hourly_rate * 24 * 30  # Monthly cost
    
    def _estimate_asg_cost(self, asg: Dict) -> float:
        """Estimate monthly cost of Auto Scaling Group"""
        # Simplified calculation - would need actual instance types
        return asg['DesiredCapacity'] * 70  # Assume $70/month per instance
    
    def _estimate_ecs_cost(self, service: Dict) -> float:
        """Estimate monthly cost of ECS service"""
        if service.get('launchType') == 'FARGATE':
            # Fargate pricing
            return service['desiredCount'] * 30  # Simplified
        else:
            # EC2 launch type
            return service['desiredCount'] * 50  # Simplified
    
    def _analyze_uptime_pattern(self, instance_id: str) -> Dict:
        """Analyze uptime patterns of an instance"""
        # Placeholder - would analyze CloudWatch metrics
        return {'pattern': 'continuous', 'peak_hours': [9, 17]}
    
    def _analyze_scaling_pattern(self, asg_name: str) -> Dict:
        """Analyze scaling patterns of ASG"""
        # Placeholder - would analyze CloudWatch metrics
        return {'pattern': 'stable', 'scale_events_per_day': 2}
    
    def _get_asg_instance_types(self, asg: Dict) -> List[str]:
        """Get instance types used in ASG"""
        # Simplified - would parse launch templates/configurations
        return ['m5.large']

def main():
    """Main function to demonstrate spot optimization"""
    optimizer = SpotInstanceOptimizer()
    
    try:
        print("Analyzing workloads for spot instance opportunities...")
        opportunities = optimizer.identify_spot_opportunities()
        
        # Generate and display report
        report = optimizer.generate_spot_optimization_report(opportunities)
        print("\n" + report)
        
        # Save detailed analysis
        with open('spot_optimization_analysis.json', 'w') as f:
            # Convert SpotRecommendation objects to dicts for JSON serialization
            serializable_opportunities = {}
            for category, recs in opportunities.items():
                serializable_opportunities[category] = [
                    {
                        'workload_name': rec.workload_name,
                        'strategy': rec.strategy,
                        'instance_types': rec.instance_types,
                        'allocation_strategy': rec.allocation_strategy,
                        'target_capacity': rec.target_capacity,
                        'on_demand_percentage': rec.on_demand_percentage,
                        'spot_percentage': rec.spot_percentage,
                        'estimated_monthly_savings': rec.estimated_monthly_savings,
                        'risk_level': rec.risk_level,
                        'implementation_complexity': rec.implementation_complexity
                    }
                    for rec in recs
                ]
            
            json.dump(serializable_opportunities, f, indent=2, default=str)
        
        print(f"\nDetailed analysis saved to spot_optimization_analysis.json")
        
        # Show sample spot fleet configuration
        if opportunities.get('batch_processing'):
            sample_rec = opportunities['batch_processing'][0]
            config = optimizer.create_spot_fleet_configuration(sample_rec)
            
            with open('sample_spot_fleet_config.json', 'w') as f:
                json.dump(config, f, indent=2)
            
            print("Sample spot fleet configuration saved to sample_spot_fleet_config.json")
        
    except Exception as e:
        print(f"Error during spot optimization analysis: {e}")
        print("Make sure you have proper AWS credentials and permissions.")

if __name__ == "__main__":
    main()