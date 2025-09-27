import boto3
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any
import numpy as np
from dataclasses import dataclass

@dataclass
class UtilizationMetrics:
    cpu_average: float
    memory_average: float
    network_in: float
    network_out: float
    disk_read: float
    disk_write: float

class ResourceRightsizer:
    def __init__(self):
        self.ec2 = boto3.client('ec2')
        self.cloudwatch = boto3.client('cloudwatch')
        self.rds = boto3.client('rds')
        self.ecs = boto3.client('ecs')
        
        # Utilization thresholds for rightsizing decisions
        self.thresholds = {
            'cpu_low': 20,
            'cpu_high': 80,
            'memory_low': 30,
            'memory_high': 85,
            'network_low': 10,
            'network_high': 70
        }
        
        # Instance type mappings for rightsizing
        self.instance_families = {
            't3': ['t3.nano', 't3.micro', 't3.small', 't3.medium', 't3.large', 't3.xlarge', 't3.2xlarge'],
            't2': ['t2.nano', 't2.micro', 't2.small', 't2.medium', 't2.large', 't2.xlarge', 't2.2xlarge'],
            'm5': ['m5.large', 'm5.xlarge', 'm5.2xlarge', 'm5.4xlarge', 'm5.8xlarge', 'm5.12xlarge', 'm5.16xlarge', 'm5.24xlarge'],
            'c5': ['c5.large', 'c5.xlarge', 'c5.2xlarge', 'c5.4xlarge', 'c5.9xlarge', 'c5.12xlarge', 'c5.18xlarge', 'c5.24xlarge'],
            'r5': ['r5.large', 'r5.xlarge', 'r5.2xlarge', 'r5.4xlarge', 'r5.8xlarge', 'r5.12xlarge', 'r5.16xlarge', 'r5.24xlarge']
        }
        
        # Simplified cost estimates (would need real-time pricing)
        self.hourly_costs = {
            't3.nano': 0.0052,
            't3.micro': 0.0104,
            't3.small': 0.0208,
            't3.medium': 0.0416,
            't3.large': 0.0832,
            't3.xlarge': 0.1664,
            't3.2xlarge': 0.3328,
            'm5.large': 0.096,
            'm5.xlarge': 0.192,
            'm5.2xlarge': 0.384,
            'm5.4xlarge': 0.768,
            'm5.8xlarge': 1.536,
            'm5.12xlarge': 2.304,
            'c5.large': 0.085,
            'c5.xlarge': 0.17,
            'c5.2xlarge': 0.34,
            'c5.4xlarge': 0.68,
            'r5.large': 0.126,
            'r5.xlarge': 0.252,
            'r5.2xlarge': 0.504
        }
    
    def analyze_rightsizing_opportunities(self, time_period_days: int = 14):
        """Find rightsizing opportunities across all resources"""
        print(f"Analyzing rightsizing opportunities over {time_period_days} days...")
        
        opportunities = {
            'ec2_instances': self._rightsize_ec2(time_period_days),
            'rds_instances': self._rightsize_rds(time_period_days),
            'containers': self._rightsize_containers(time_period_days),
            'lambda_functions': self._rightsize_lambda(),
            'storage_volumes': self._rightsize_storage()
        }
        
        return self._prioritize_opportunities(opportunities)
    
    def _rightsize_ec2(self, time_period_days: int) -> List[Dict]:
        """Rightsize EC2 instances"""
        recommendations = []
        
        try:
            instances = self._get_running_instances()
            print(f"Analyzing {len(instances)} running EC2 instances...")
            
            for instance in instances:
                instance_id = instance['InstanceId']
                current_type = instance['InstanceType']
                
                # Get utilization metrics
                utilization = self._get_instance_utilization(instance_id, time_period_days)
                
                if utilization:
                    # Determine recommended instance type
                    recommended_type = self._recommend_instance_type(current_type, utilization)
                    
                    if recommended_type != current_type:
                        current_cost = self.hourly_costs.get(current_type, 0.1)
                        new_cost = self.hourly_costs.get(recommended_type, 0.1)
                        monthly_savings = (current_cost - new_cost) * 24 * 30
                        
                        recommendation = {
                            'resource_type': 'EC2 Instance',
                            'resource_id': instance_id,
                            'current_type': current_type,
                            'recommended_type': recommended_type,
                            'reason': self._generate_rightsizing_reason(utilization, current_type, recommended_type),
                            'current_hourly_cost': current_cost,
                            'new_hourly_cost': new_cost,
                            'monthly_savings': monthly_savings,
                            'utilization_summary': {
                                'cpu_avg': utilization.cpu_average,
                                'memory_avg': utilization.memory_average,
                                'network_in': utilization.network_in,
                                'network_out': utilization.network_out
                            },
                            'confidence': self._calculate_confidence(utilization, time_period_days),
                            'effort': 'medium',
                            'risk': 'low' if monthly_savings > 0 else 'medium'
                        }
                        
                        recommendations.append(recommendation)
                        
        except Exception as e:
            print(f"Error analyzing EC2 instances: {e}")
        
        return recommendations
    
    def _get_running_instances(self) -> List[Dict]:
        """Get all running EC2 instances"""
        try:
            response = self.ec2.describe_instances(
                Filters=[{'Name': 'instance-state-name', 'Values': ['running']}]
            )
            
            instances = []
            for reservation in response['Reservations']:
                instances.extend(reservation['Instances'])
            
            return instances
        except Exception as e:
            print(f"Error getting running instances: {e}")
            return []
    
    def _get_instance_utilization(self, instance_id: str, days: int) -> UtilizationMetrics:
        """Get comprehensive utilization metrics for an instance"""
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=days)
        
        try:
            # CPU Utilization
            cpu_response = self.cloudwatch.get_metric_statistics(
                Namespace='AWS/EC2',
                MetricName='CPUUtilization',
                Dimensions=[{'Name': 'InstanceId', 'Value': instance_id}],
                StartTime=start_time,
                EndTime=end_time,
                Period=3600,  # 1 hour
                Statistics=['Average']
            )
            
            # Network In
            network_in_response = self.cloudwatch.get_metric_statistics(
                Namespace='AWS/EC2',
                MetricName='NetworkIn',
                Dimensions=[{'Name': 'InstanceId', 'Value': instance_id}],
                StartTime=start_time,
                EndTime=end_time,
                Period=3600,
                Statistics=['Average']
            )
            
            # Network Out
            network_out_response = self.cloudwatch.get_metric_statistics(
                Namespace='AWS/EC2',
                MetricName='NetworkOut',
                Dimensions=[{'Name': 'InstanceId', 'Value': instance_id}],
                StartTime=start_time,
                EndTime=end_time,
                Period=3600,
                Statistics=['Average']
            )
            
            # Process metrics
            cpu_avg = self._calculate_average_metric(cpu_response['Datapoints'])
            network_in_avg = self._calculate_average_metric(network_in_response['Datapoints'])
            network_out_avg = self._calculate_average_metric(network_out_response['Datapoints'])
            
            # Memory metrics would require CloudWatch Agent
            # For now, we'll estimate based on instance type and CPU usage
            memory_avg = self._estimate_memory_usage(cpu_avg)
            
            return UtilizationMetrics(
                cpu_average=cpu_avg,
                memory_average=memory_avg,
                network_in=network_in_avg,
                network_out=network_out_avg,
                disk_read=0,  # Would need additional metrics
                disk_write=0
            )
            
        except Exception as e:
            print(f"Error getting utilization for {instance_id}: {e}")
            return None
    
    def _calculate_average_metric(self, datapoints: List[Dict]) -> float:
        """Calculate average value from CloudWatch datapoints"""
        if not datapoints:
            return 0
        
        values = [dp['Average'] for dp in datapoints]
        return sum(values) / len(values)
    
    def _estimate_memory_usage(self, cpu_usage: float) -> float:
        """Estimate memory usage based on CPU usage pattern"""
        # Simple heuristic: memory usage often correlates with CPU usage
        # This would need real memory metrics for accurate rightsizing
        if cpu_usage < 10:
            return 20  # Low memory usage
        elif cpu_usage < 30:
            return 40
        elif cpu_usage < 60:
            return 60
        else:
            return 80
    
    def _recommend_instance_type(self, current_type: str, utilization: UtilizationMetrics) -> str:
        """Recommend optimal instance type based on utilization"""
        # Parse current instance family and size
        family, size_index = self._parse_instance_type(current_type)
        
        if not family:
            return current_type
        
        # Calculate required capacity
        cpu_requirement = max(utilization.cpu_average * 1.2, 10)  # 20% buffer
        memory_requirement = max(utilization.memory_average * 1.2, 20)
        
        # Find optimal size within the same family
        recommended_size_index = self._find_optimal_size(
            family, size_index, cpu_requirement, memory_requirement
        )
        
        if recommended_size_index != size_index:
            instance_types = self.instance_families.get(family, [current_type])
            if 0 <= recommended_size_index < len(instance_types):
                return instance_types[recommended_size_index]
        
        return current_type
    
    def _parse_instance_type(self, instance_type: str) -> tuple:
        """Parse instance type to get family and size index"""
        try:
            parts = instance_type.split('.')
            family = parts[0]
            
            for fam, types in self.instance_families.items():
                if fam == family and instance_type in types:
                    return family, types.index(instance_type)
            
            return None, 0
        except:
            return None, 0
    
    def _find_optimal_size(self, family: str, current_size_index: int, 
                          cpu_requirement: float, memory_requirement: float) -> int:
        """Find optimal instance size within family"""
        instance_types = self.instance_families.get(family, [])
        
        # Simple heuristic based on utilization
        if cpu_requirement < 25 and memory_requirement < 35:
            # Can downsize
            return max(0, current_size_index - 1)
        elif cpu_requirement > 70 or memory_requirement > 80:
            # Should upsize
            return min(len(instance_types) - 1, current_size_index + 1)
        else:
            # Current size is appropriate
            return current_size_index
    
    def _generate_rightsizing_reason(self, utilization: UtilizationMetrics, 
                                   current_type: str, recommended_type: str) -> str:
        """Generate human-readable reason for rightsizing recommendation"""
        reasons = []
        
        if utilization.cpu_average < self.thresholds['cpu_low']:
            reasons.append(f"Low CPU utilization ({utilization.cpu_average:.1f}%)")
        
        if utilization.memory_average < self.thresholds['memory_low']:
            reasons.append(f"Low memory utilization ({utilization.memory_average:.1f}%)")
        
        if utilization.cpu_average > self.thresholds['cpu_high']:
            reasons.append(f"High CPU utilization ({utilization.cpu_average:.1f}%)")
        
        if utilization.memory_average > self.thresholds['memory_high']:
            reasons.append(f"High memory utilization ({utilization.memory_average:.1f}%)")
        
        action = "downsize" if self._is_downsize(current_type, recommended_type) else "upsize"
        
        return f"Recommendation to {action}: " + ", ".join(reasons)
    
    def _is_downsize(self, current_type: str, recommended_type: str) -> bool:
        """Check if recommendation is a downsize"""
        current_cost = self.hourly_costs.get(current_type, 0)
        recommended_cost = self.hourly_costs.get(recommended_type, 0)
        return recommended_cost < current_cost
    
    def _calculate_confidence(self, utilization: UtilizationMetrics, days: int) -> str:
        """Calculate confidence level in the recommendation"""
        if days >= 14:
            if utilization.cpu_average < 15 or utilization.cpu_average > 85:
                return "high"
            elif utilization.cpu_average < 25 or utilization.cpu_average > 75:
                return "medium"
            else:
                return "low"
        else:
            return "low"  # Not enough data
    
    def _rightsize_rds(self, time_period_days: int) -> List[Dict]:
        """Rightsize RDS instances"""
        recommendations = []
        
        try:
            response = self.rds.describe_db_instances()
            
            for db_instance in response['DBInstances']:
                if db_instance['DBInstanceStatus'] == 'available':
                    db_identifier = db_instance['DBInstanceIdentifier']
                    current_class = db_instance['DBInstanceClass']
                    
                    # Get RDS metrics
                    utilization = self._get_rds_utilization(db_identifier, time_period_days)
                    
                    if utilization and utilization.cpu_average < 30:  # Low utilization
                        recommended_class = self._recommend_rds_class(current_class, utilization)
                        
                        if recommended_class != current_class:
                            recommendations.append({
                                'resource_type': 'RDS Instance',
                                'resource_id': db_identifier,
                                'current_type': current_class,
                                'recommended_type': recommended_class,
                                'reason': f"Low CPU utilization ({utilization.cpu_average:.1f}%)",
                                'monthly_savings': self._calculate_rds_savings(current_class, recommended_class),
                                'effort': 'high',  # RDS resize requires downtime
                                'risk': 'medium'
                            })
                            
        except Exception as e:
            print(f"Error analyzing RDS instances: {e}")
        
        return recommendations
    
    def _get_rds_utilization(self, db_identifier: str, days: int) -> UtilizationMetrics:
        """Get RDS utilization metrics"""
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=days)
        
        try:
            cpu_response = self.cloudwatch.get_metric_statistics(
                Namespace='AWS/RDS',
                MetricName='CPUUtilization',
                Dimensions=[{'Name': 'DBInstanceIdentifier', 'Value': db_identifier}],
                StartTime=start_time,
                EndTime=end_time,
                Period=3600,
                Statistics=['Average']
            )
            
            cpu_avg = self._calculate_average_metric(cpu_response['Datapoints'])
            
            return UtilizationMetrics(
                cpu_average=cpu_avg,
                memory_average=0,  # Would need additional metrics
                network_in=0,
                network_out=0,
                disk_read=0,
                disk_write=0
            )
            
        except Exception as e:
            print(f"Error getting RDS utilization for {db_identifier}: {e}")
            return None
    
    def _recommend_rds_class(self, current_class: str, utilization: UtilizationMetrics) -> str:
        """Recommend RDS instance class"""
        # Simplified RDS class recommendation logic
        if utilization.cpu_average < 20:
            # Map to smaller instance class
            class_mappings = {
                'db.t3.large': 'db.t3.medium',
                'db.t3.medium': 'db.t3.small',
                'db.m5.xlarge': 'db.m5.large',
                'db.m5.large': 'db.t3.medium'
            }
            return class_mappings.get(current_class, current_class)
        
        return current_class
    
    def _calculate_rds_savings(self, current_class: str, recommended_class: str) -> float:
        """Calculate RDS rightsizing savings"""
        # Simplified RDS cost calculation
        rds_costs = {
            'db.t3.small': 15,
            'db.t3.medium': 30,
            'db.t3.large': 60,
            'db.m5.large': 120,
            'db.m5.xlarge': 240
        }
        
        current_cost = rds_costs.get(current_class, 50)
        new_cost = rds_costs.get(recommended_class, 50)
        
        return current_cost - new_cost
    
    def _rightsize_containers(self, time_period_days: int) -> List[Dict]:
        """Rightsize ECS/Fargate containers"""
        # Placeholder for container rightsizing
        return []
    
    def _rightsize_lambda(self) -> List[Dict]:
        """Rightsize Lambda functions"""
        # Placeholder for Lambda rightsizing
        return []
    
    def _rightsize_storage(self) -> List[Dict]:
        """Rightsize storage volumes"""
        recommendations = []
        
        try:
            volumes = self.ec2.describe_volumes()
            
            for volume in volumes['Volumes']:
                if volume['State'] == 'in-use':
                    # Analyze volume performance
                    volume_id = volume['VolumeId']
                    current_type = volume['VolumeType']
                    size = volume['Size']
                    
                    # Get volume metrics
                    utilization = self._get_volume_utilization(volume_id)
                    
                    if utilization:
                        recommended_type = self._recommend_volume_type(current_type, utilization)
                        
                        if recommended_type != current_type:
                            savings = self._calculate_volume_savings(current_type, recommended_type, size)
                            
                            recommendations.append({
                                'resource_type': 'EBS Volume',
                                'resource_id': volume_id,
                                'current_type': current_type,
                                'recommended_type': recommended_type,
                                'size_gb': size,
                                'reason': self._get_volume_reason(current_type, recommended_type, utilization),
                                'monthly_savings': savings,
                                'effort': 'low',
                                'risk': 'low'
                            })
                            
        except Exception as e:
            print(f"Error analyzing storage volumes: {e}")
        
        return recommendations
    
    def _get_volume_utilization(self, volume_id: str) -> Dict:
        """Get EBS volume utilization metrics"""
        # Placeholder for volume utilization analysis
        return {'iops_utilization': 20, 'throughput_utilization': 30}
    
    def _recommend_volume_type(self, current_type: str, utilization: Dict) -> str:
        """Recommend optimal volume type"""
        iops_util = utilization.get('iops_utilization', 50)
        
        if current_type == 'io1' and iops_util < 30:
            return 'gp3'
        elif current_type == 'gp2':
            return 'gp3'  # gp3 is usually more cost effective
        
        return current_type
    
    def _calculate_volume_savings(self, current_type: str, recommended_type: str, size: int) -> float:
        """Calculate volume type change savings"""
        cost_per_gb = {
            'gp2': 0.10,
            'gp3': 0.08,
            'io1': 0.125,
            'io2': 0.125,
            'st1': 0.045,
            'sc1': 0.025
        }
        
        current_cost = size * cost_per_gb.get(current_type, 0.10)
        new_cost = size * cost_per_gb.get(recommended_type, 0.10)
        
        return current_cost - new_cost
    
    def _get_volume_reason(self, current_type: str, recommended_type: str, utilization: Dict) -> str:
        """Generate reason for volume type change"""
        return f"Low IOPS utilization ({utilization['iops_utilization']}%), can switch from {current_type} to {recommended_type}"
    
    def _prioritize_opportunities(self, opportunities: Dict) -> Dict:
        """Prioritize all rightsizing opportunities"""
        all_opportunities = []
        
        for category, ops in opportunities.items():
            for op in ops:
                op['category'] = category
                all_opportunities.append(op)
        
        # Sort by monthly savings (descending)
        all_opportunities.sort(key=lambda x: x.get('monthly_savings', 0), reverse=True)
        
        return {
            'total_opportunities': len(all_opportunities),
            'total_monthly_savings': sum(op.get('monthly_savings', 0) for op in all_opportunities),
            'opportunities': all_opportunities[:20],  # Top 20 opportunities
            'summary_by_category': self._summarize_by_category(opportunities)
        }
    
    def _summarize_by_category(self, opportunities: Dict) -> Dict:
        """Summarize opportunities by category"""
        summary = {}
        
        for category, ops in opportunities.items():
            if ops:
                total_savings = sum(op.get('monthly_savings', 0) for op in ops)
                summary[category] = {
                    'count': len(ops),
                    'total_monthly_savings': total_savings,
                    'avg_savings_per_resource': total_savings / len(ops) if ops else 0
                }
        
        return summary

class AutomatedRightsizer:
    """Automated rightsizing implementation"""
    
    def __init__(self):
        self.ec2 = boto3.client('ec2')
        self.rightsizer = ResourceRightsizer()
        
    def execute_rightsizing(self, recommendations: List[Dict], dry_run: bool = True):
        """Execute rightsizing recommendations"""
        results = []
        
        for recommendation in recommendations:
            try:
                if recommendation.get('risk', 'medium') == 'low' and recommendation.get('monthly_savings', 0) > 10:
                    result = self._resize_resource(recommendation, dry_run=dry_run)
                    results.append(result)
                else:
                    print(f"Skipping {recommendation['resource_id']} - requires manual approval")
                    
            except Exception as e:
                print(f"Failed to resize {recommendation['resource_id']}: {e}")
                results.append({
                    'resource_id': recommendation['resource_id'],
                    'status': 'failed',
                    'error': str(e)
                })
        
        return results
    
    def _resize_resource(self, recommendation: Dict, dry_run: bool) -> Dict:
        """Resize a specific resource"""
        resource_type = recommendation['resource_type']
        resource_id = recommendation['resource_id']
        
        if resource_type == 'EC2 Instance':
            return self._resize_ec2_instance(recommendation, dry_run)
        elif resource_type == 'EBS Volume':
            return self._modify_ebs_volume(recommendation, dry_run)
        else:
            return {'resource_id': resource_id, 'status': 'unsupported', 'message': 'Resource type not supported for automation'}
    
    def _resize_ec2_instance(self, recommendation: Dict, dry_run: bool) -> Dict:
        """Resize an EC2 instance"""
        instance_id = recommendation['resource_id']
        new_type = recommendation['recommended_type']
        
        try:
            # Create snapshot for rollback
            snapshot_id = self._create_instance_snapshot(instance_id) if not dry_run else None
            
            if not dry_run:
                # Stop instance
                print(f"Stopping instance {instance_id}...")
                self.ec2.stop_instances(InstanceIds=[instance_id])
                self._wait_for_instance_state(instance_id, 'stopped')
                
                # Change instance type
                print(f"Changing instance type to {new_type}...")
                self.ec2.modify_instance_attribute(
                    InstanceId=instance_id,
                    InstanceType={'Value': new_type}
                )
                
                # Start instance
                print(f"Starting instance {instance_id}...")
                self.ec2.start_instances(InstanceIds=[instance_id])
                self._wait_for_instance_state(instance_id, 'running')
            
            return {
                'resource_id': instance_id,
                'status': 'success' if not dry_run else 'dry_run_success',
                'old_type': recommendation['current_type'],
                'new_type': new_type,
                'snapshot_id': snapshot_id,
                'estimated_monthly_savings': recommendation['monthly_savings']
            }
            
        except Exception as e:
            return {
                'resource_id': instance_id,
                'status': 'failed',
                'error': str(e)
            }
    
    def _create_instance_snapshot(self, instance_id: str) -> str:
        """Create snapshot of instance root volume for rollback"""
        try:
            # Get instance details
            instance = self.ec2.describe_instances(InstanceIds=[instance_id])['Reservations'][0]['Instances'][0]
            
            # Find root volume
            root_device = instance.get('RootDeviceName', '/dev/sda1')
            root_volume_id = None
            
            for bdm in instance.get('BlockDeviceMappings', []):
                if bdm['DeviceName'] == root_device:
                    root_volume_id = bdm['Ebs']['VolumeId']
                    break
            
            if root_volume_id:
                # Create snapshot
                snapshot = self.ec2.create_snapshot(
                    VolumeId=root_volume_id,
                    Description=f'Pre-rightsizing snapshot for {instance_id}'
                )
                return snapshot['SnapshotId']
                
        except Exception as e:
            print(f"Failed to create snapshot for {instance_id}: {e}")
        
        return None
    
    def _wait_for_instance_state(self, instance_id: str, target_state: str, timeout: int = 300):
        """Wait for instance to reach target state"""
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            try:
                response = self.ec2.describe_instances(InstanceIds=[instance_id])
                current_state = response['Reservations'][0]['Instances'][0]['State']['Name']
                
                if current_state == target_state:
                    return True
                    
                time.sleep(10)
                
            except Exception as e:
                print(f"Error checking instance state: {e}")
                time.sleep(10)
        
        raise Exception(f"Timeout waiting for instance {instance_id} to reach {target_state}")
    
    def _modify_ebs_volume(self, recommendation: Dict, dry_run: bool) -> Dict:
        """Modify EBS volume type"""
        volume_id = recommendation['resource_id']
        new_type = recommendation['recommended_type']
        
        try:
            if not dry_run:
                self.ec2.modify_volume(
                    VolumeId=volume_id,
                    VolumeType=new_type
                )
            
            return {
                'resource_id': volume_id,
                'status': 'success' if not dry_run else 'dry_run_success',
                'old_type': recommendation['current_type'],
                'new_type': new_type,
                'estimated_monthly_savings': recommendation['monthly_savings']
            }
            
        except Exception as e:
            return {
                'resource_id': volume_id,
                'status': 'failed',
                'error': str(e)
            }

def main():
    """Main function to demonstrate rightsizing analysis"""
    rightsizer = ResourceRightsizer()
    
    print("Starting resource rightsizing analysis...")
    
    try:
        # Analyze rightsizing opportunities
        opportunities = rightsizer.analyze_rightsizing_opportunities(14)
        
        print(f"\nFound {opportunities['total_opportunities']} rightsizing opportunities")
        print(f"Total potential monthly savings: ${opportunities['total_monthly_savings']:.2f}")
        
        print("\nTop 10 Opportunities:")
        print("-" * 80)
        print(f"{'Resource Type':<15} {'Resource ID':<20} {'Current':<12} {'Recommended':<12} {'Savings':<10}")
        print("-" * 80)
        
        for i, opp in enumerate(opportunities['opportunities'][:10], 1):
            print(f"{opp['resource_type']:<15} {opp['resource_id']:<20} {opp['current_type']:<12} "
                  f"{opp['recommended_type']:<12} ${opp['monthly_savings']:>8.2f}")
        
        # Save detailed report
        with open('rightsizing_report.json', 'w') as f:
            json.dump(opportunities, f, indent=2, default=str)
        
        print(f"\nDetailed report saved to rightsizing_report.json")
        
        # Demonstrate automated rightsizing (dry run)
        print("\nTesting automated rightsizing (dry run)...")
        automator = AutomatedRightsizer()
        results = automator.execute_rightsizing(opportunities['opportunities'][:3], dry_run=True)
        
        for result in results:
            print(f"Resource {result['resource_id']}: {result['status']}")
            
    except Exception as e:
        print(f"Error during rightsizing analysis: {e}")
        print("Make sure you have proper AWS credentials and permissions.")

if __name__ == "__main__":
    main()