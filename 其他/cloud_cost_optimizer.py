#!/usr/bin/env python3
"""
Cloud Cost Optimization Suite
Comprehensive cost analysis and optimization for AWS, Azure, and GCP
"""

import boto3
import pandas as pd
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor, as_completed
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class CostRecommendation:
    resource_id: str
    resource_type: str
    current_cost: float
    optimized_cost: float
    monthly_savings: float
    confidence: str
    effort: str
    risk: str
    action: str
    reason: str

class CloudCostAnalyzer:
    """Comprehensive cloud cost analysis engine"""
    
    def __init__(self, cloud_provider: str = 'aws'):
        self.provider = cloud_provider
        self.cost_data = {}
        self.recommendations = []
        
        if cloud_provider == 'aws':
            self.ce_client = boto3.client('ce')
            self.ec2_client = boto3.client('ec2')
            self.cloudwatch = boto3.client('cloudwatch')
            self.s3_client = boto3.client('s3')
            self.rds_client = boto3.client('rds')
            
    def analyze_comprehensive_costs(self, days: int = 30) -> Dict[str, Any]:
        """Perform comprehensive cost analysis"""
        logger.info(f"Starting comprehensive cost analysis for last {days} days")
        
        analysis = {
            'total_cost': self._get_total_cost(days),
            'cost_by_service': self._analyze_by_service(days),
            'cost_by_resource': self._analyze_by_resource(days),
            'cost_trends': self._analyze_cost_trends(days),
            'anomalies': self._detect_cost_anomalies(days),
            'waste_analysis': self._identify_waste(),
            'optimization_opportunities': self._find_optimization_opportunities(),
            'rightsizing_recommendations': self._analyze_rightsizing(),
            'reservation_opportunities': self._analyze_reservations(),
            'storage_optimizations': self._analyze_storage()
        }
        
        return self._generate_comprehensive_report(analysis)
    
    def _get_total_cost(self, days: int) -> Dict[str, float]:
        """Get total costs for the period"""
        try:
            response = self.ce_client.get_cost_and_usage(
                TimePeriod={
                    'Start': (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d'),
                    'End': datetime.now().strftime('%Y-%m-%d')
                },
                Granularity='MONTHLY',
                Metrics=['UnblendedCost']
            )
            
            total = 0
            for result in response['ResultsByTime']:
                total += float(result['Total']['UnblendedCost']['Amount'])
                
            return {
                'total': total,
                'daily_average': total / days,
                'projected_monthly': (total / days) * 30
            }
        except Exception as e:
            logger.error(f"Error getting total cost: {e}")
            return {'total': 0, 'daily_average': 0, 'projected_monthly': 0}
    
    def _analyze_by_service(self, days: int) -> Dict[str, Dict]:
        """Analyze costs breakdown by AWS service"""
        try:
            response = self.ce_client.get_cost_and_usage(
                TimePeriod={
                    'Start': (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d'),
                    'End': datetime.now().strftime('%Y-%m-%d')
                },
                Granularity='DAILY',
                Metrics=['UnblendedCost'],
                GroupBy=[{'Type': 'DIMENSION', 'Key': 'SERVICE'}]
            )
            
            service_costs = {}
            for result in response['ResultsByTime']:
                for group in result['Groups']:
                    service = group['Keys'][0]
                    cost = float(group['Metrics']['UnblendedCost']['Amount'])
                    
                    if service not in service_costs:
                        service_costs[service] = {'daily_costs': [], 'total': 0}
                    
                    service_costs[service]['daily_costs'].append(cost)
                    service_costs[service]['total'] += cost
            
            # Calculate statistics for each service
            for service, data in service_costs.items():
                costs = data['daily_costs']
                service_costs[service].update({
                    'average_daily': sum(costs) / len(costs) if costs else 0,
                    'trend': self._calculate_trend(costs),
                    'std_deviation': np.std(costs) if len(costs) > 1 else 0,
                    'coefficient_variation': np.std(costs) / np.mean(costs) if np.mean(costs) > 0 else 0
                })
            
            return service_costs
        except Exception as e:
            logger.error(f"Error analyzing by service: {e}")
            return {}
    
    def _calculate_trend(self, costs: List[float]) -> float:
        """Calculate cost trend (percentage change)"""
        if len(costs) < 2:
            return 0
        
        first_half = costs[:len(costs)//2]
        second_half = costs[len(costs)//2:]
        
        avg_first = sum(first_half) / len(first_half)
        avg_second = sum(second_half) / len(second_half)
        
        if avg_first == 0:
            return 100 if avg_second > 0 else 0
        
        return ((avg_second - avg_first) / avg_first) * 100
    
    def _identify_waste(self) -> Dict[str, Any]:
        """Identify wasted cloud resources"""
        logger.info("Identifying wasted resources...")
        
        waste_categories = {
            'unused_ec2_instances': self._find_unused_ec2(),
            'unattached_ebs_volumes': self._find_unattached_volumes(),
            'idle_load_balancers': self._find_idle_load_balancers(),
            'old_snapshots': self._find_old_snapshots(),
            'oversized_rds': self._find_oversized_rds(),
            'unused_elastic_ips': self._find_unused_elastic_ips()
        }
        
        total_waste = 0
        for category, items in waste_categories.items():
            if isinstance(items, list):
                total_waste += sum(item.get('estimated_savings', 0) for item in items)
        
        return {
            'categories': waste_categories,
            'total_monthly_waste': total_waste,
            'top_waste_sources': self._get_top_waste_sources(waste_categories)
        }
    
    def _find_unused_ec2(self) -> List[Dict]:
        """Find EC2 instances with low utilization"""
        unused_instances = []
        
        try:
            # Get all running instances
            response = self.ec2_client.describe_instances(
                Filters=[{'Name': 'instance-state-name', 'Values': ['running']}]
            )
            
            for reservation in response['Reservations']:
                for instance in reservation['Instances']:
                    instance_id = instance['InstanceId']
                    
                    # Get CPU utilization for last 7 days
                    cpu_metrics = self.cloudwatch.get_metric_statistics(
                        Namespace='AWS/EC2',
                        MetricName='CPUUtilization',
                        Dimensions=[{'Name': 'InstanceId', 'Value': instance_id}],
                        StartTime=datetime.now() - timedelta(days=7),
                        EndTime=datetime.now(),
                        Period=3600,
                        Statistics=['Average']
                    )
                    
                    if cpu_metrics['Datapoints']:
                        avg_cpu = sum(d['Average'] for d in cpu_metrics['Datapoints']) / len(cpu_metrics['Datapoints'])
                        
                        if avg_cpu < 5:  # Less than 5% CPU usage
                            monthly_cost = self._estimate_instance_monthly_cost(instance)
                            unused_instances.append({
                                'instance_id': instance_id,
                                'instance_type': instance['InstanceType'],
                                'avg_cpu_utilization': round(avg_cpu, 2),
                                'estimated_savings': monthly_cost,
                                'recommendation': 'Stop or terminate instance',
                                'risk': 'low' if avg_cpu < 1 else 'medium'
                            })
            
        except Exception as e:
            logger.error(f"Error finding unused EC2 instances: {e}")
        
        return unused_instances
    
    def _find_unattached_volumes(self) -> List[Dict]:
        """Find EBS volumes not attached to instances"""
        unattached_volumes = []
        
        try:
            response = self.ec2_client.describe_volumes(
                Filters=[{'Name': 'status', 'Values': ['available']}]
            )
            
            for volume in response['Volumes']:
                # Calculate monthly cost
                size_gb = volume['Size']
                volume_type = volume['VolumeType']
                monthly_cost = self._calculate_ebs_monthly_cost(size_gb, volume_type)
                
                unattached_volumes.append({
                    'volume_id': volume['VolumeId'],
                    'size_gb': size_gb,
                    'volume_type': volume_type,
                    'estimated_savings': monthly_cost,
                    'age_days': (datetime.now() - volume['CreateTime'].replace(tzinfo=None)).days,
                    'recommendation': 'Delete if not needed for backup'
                })
                
        except Exception as e:
            logger.error(f"Error finding unattached volumes: {e}")
        
        return unattached_volumes
    
    def _estimate_instance_monthly_cost(self, instance: Dict) -> float:
        """Estimate monthly cost for EC2 instance"""
        # Simplified pricing - in production, use AWS Pricing API
        pricing_map = {
            't3.nano': 3.80, 't3.micro': 7.59, 't3.small': 15.18,
            't3.medium': 30.37, 't3.large': 60.74, 't3.xlarge': 121.47,
            'm5.large': 70.08, 'm5.xlarge': 140.16, 'm5.2xlarge': 280.32,
            'c5.large': 62.56, 'c5.xlarge': 125.11, 'r5.large': 91.25
        }
        
        instance_type = instance['InstanceType']
        return pricing_map.get(instance_type, 100)  # Default estimate
    
    def _calculate_ebs_monthly_cost(self, size_gb: int, volume_type: str) -> float:
        """Calculate monthly EBS cost"""
        pricing_per_gb = {
            'gp2': 0.10,
            'gp3': 0.08,
            'io1': 0.125,
            'io2': 0.125,
            'st1': 0.045,
            'sc1': 0.025
        }
        
        rate = pricing_per_gb.get(volume_type, 0.10)
        return size_gb * rate

class ResourceRightsizer:
    """Intelligent resource rightsizing engine"""
    
    def __init__(self):
        self.ec2_client = boto3.client('ec2')
        self.cloudwatch = boto3.client('cloudwatch')
        self.rds_client = boto3.client('rds')
        
        self.utilization_thresholds = {
            'cpu_low': 20,
            'cpu_high': 80,
            'memory_low': 30,
            'memory_high': 85,
            'network_low': 10
        }
    
    def analyze_rightsizing_opportunities(self) -> Dict[str, List[CostRecommendation]]:
        """Find rightsizing opportunities across all resources"""
        logger.info("Analyzing rightsizing opportunities...")
        
        opportunities = {
            'ec2_instances': self._rightsize_ec2_instances(),
            'rds_instances': self._rightsize_rds_instances(),
            'ebs_volumes': self._rightsize_ebs_volumes()
        }
        
        return opportunities
    
    def _rightsize_ec2_instances(self) -> List[CostRecommendation]:
        """Analyze EC2 instances for rightsizing"""
        recommendations = []
        
        try:
            response = self.ec2_client.describe_instances(
                Filters=[{'Name': 'instance-state-name', 'Values': ['running']}]
            )
            
            for reservation in response['Reservations']:
                for instance in reservation['Instances']:
                    instance_id = instance['InstanceId']
                    current_type = instance['InstanceType']
                    
                    # Get utilization metrics
                    utilization = self._get_instance_utilization(instance_id)
                    
                    # Determine optimal instance type
                    recommended_type = self._recommend_instance_type(current_type, utilization)
                    
                    if recommended_type != current_type:
                        current_cost = self._get_instance_monthly_cost(current_type)
                        new_cost = self._get_instance_monthly_cost(recommended_type)
                        
                        recommendation = CostRecommendation(
                            resource_id=instance_id,
                            resource_type='EC2 Instance',
                            current_cost=current_cost,
                            optimized_cost=new_cost,
                            monthly_savings=current_cost - new_cost,
                            confidence='high' if abs(utilization.get('avg_cpu', 50) - 20) > 30 else 'medium',
                            effort='medium',
                            risk='low' if new_cost < current_cost else 'medium',
                            action=f'Resize from {current_type} to {recommended_type}',
                            reason=self._generate_rightsizing_reason(utilization)
                        )
                        
                        recommendations.append(recommendation)
                        
        except Exception as e:
            logger.error(f"Error rightsizing EC2 instances: {e}")
        
        return recommendations
    
    def _get_instance_utilization(self, instance_id: str, days: int = 14) -> Dict[str, float]:
        """Get comprehensive utilization metrics for instance"""
        metrics = {}
        
        try:
            # CPU Utilization
            cpu_response = self.cloudwatch.get_metric_statistics(
                Namespace='AWS/EC2',
                MetricName='CPUUtilization',
                Dimensions=[{'Name': 'InstanceId', 'Value': instance_id}],
                StartTime=datetime.now() - timedelta(days=days),
                EndTime=datetime.now(),
                Period=3600,
                Statistics=['Average', 'Maximum']
            )
            
            if cpu_response['Datapoints']:
                cpu_data = [d['Average'] for d in cpu_response['Datapoints']]
                cpu_max = [d['Maximum'] for d in cpu_response['Datapoints']]
                
                metrics['avg_cpu'] = sum(cpu_data) / len(cpu_data)
                metrics['max_cpu'] = max(cpu_max)
                metrics['p95_cpu'] = np.percentile(cpu_data, 95)
            
            # Network utilization
            network_response = self.cloudwatch.get_metric_statistics(
                Namespace='AWS/EC2',
                MetricName='NetworkIn',
                Dimensions=[{'Name': 'InstanceId', 'Value': instance_id}],
                StartTime=datetime.now() - timedelta(days=days),
                EndTime=datetime.now(),
                Period=3600,
                Statistics=['Average']
            )
            
            if network_response['Datapoints']:
                network_data = [d['Average'] for d in network_response['Datapoints']]
                metrics['avg_network'] = sum(network_data) / len(network_data)
                
        except Exception as e:
            logger.error(f"Error getting utilization for {instance_id}: {e}")
            # Default values if metrics unavailable
            metrics = {'avg_cpu': 50, 'max_cpu': 70, 'p95_cpu': 65, 'avg_network': 1000}
        
        return metrics
    
    def _recommend_instance_type(self, current_type: str, utilization: Dict[str, float]) -> str:
        """Recommend optimal instance type based on utilization"""
        avg_cpu = utilization.get('avg_cpu', 50)
        max_cpu = utilization.get('max_cpu', 70)
        
        # Instance family mappings
        instance_families = {
            't3': ['t3.nano', 't3.micro', 't3.small', 't3.medium', 't3.large', 't3.xlarge', 't3.2xlarge'],
            'm5': ['m5.large', 'm5.xlarge', 'm5.2xlarge', 'm5.4xlarge', 'm5.8xlarge'],
            'c5': ['c5.large', 'c5.xlarge', 'c5.2xlarge', 'c5.4xlarge'],
            'r5': ['r5.large', 'r5.xlarge', 'r5.2xlarge', 'r5.4xlarge']
        }
        
        # Parse current instance
        family = current_type.split('.')[0]
        current_size = current_type.split('.')[1]
        
        if family not in instance_families:
            return current_type
        
        family_types = instance_families[family]
        current_index = family_types.index(current_type) if current_type in family_types else 0
        
        # Rightsizing logic
        if avg_cpu < 20 and max_cpu < 50:
            # Downsize
            new_index = max(0, current_index - 1)
            return family_types[new_index]
        elif avg_cpu > 60 or max_cpu > 85:
            # Upsize
            new_index = min(len(family_types) - 1, current_index + 1)
            return family_types[new_index]
        
        return current_type
    
    def _get_instance_monthly_cost(self, instance_type: str) -> float:
        """Get monthly cost for instance type"""
        # Simplified pricing - use AWS Pricing API in production
        pricing = {
            't3.nano': 3.80, 't3.micro': 7.59, 't3.small': 15.18,
            't3.medium': 30.37, 't3.large': 60.74, 't3.xlarge': 121.47,
            'm5.large': 70.08, 'm5.xlarge': 140.16, 'm5.2xlarge': 280.32,
            'c5.large': 62.56, 'c5.xlarge': 125.11, 'r5.large': 91.25
        }
        
        return pricing.get(instance_type, 100)
    
    def _generate_rightsizing_reason(self, utilization: Dict[str, float]) -> str:
        """Generate human-readable reason for rightsizing"""
        avg_cpu = utilization.get('avg_cpu', 50)
        max_cpu = utilization.get('max_cpu', 70)
        
        if avg_cpu < 20:
            return f"Low average CPU utilization ({avg_cpu:.1f}%)"
        elif avg_cpu > 60:
            return f"High average CPU utilization ({avg_cpu:.1f}%)"
        elif max_cpu > 85:
            return f"High peak CPU utilization ({max_cpu:.1f}%)"
        else:
            return "Based on utilization patterns"

class SpotInstanceOptimizer:
    """Optimize workloads for spot instances"""
    
    def __init__(self):
        self.ec2_client = boto3.client('ec2')
    
    def identify_spot_opportunities(self) -> Dict[str, List[Dict]]:
        """Identify workloads suitable for spot instances"""
        logger.info("Identifying spot instance opportunities...")
        
        opportunities = {
            'batch_processing': [],
            'dev_test_environments': [],
            'stateless_applications': [],
            'fault_tolerant_workloads': []
        }
        
        # Analyze current instances
        instances = self._get_running_instances()
        
        for instance in instances:
            suitability = self._assess_spot_suitability(instance)
            
            if suitability['suitable']:
                current_cost = self._get_instance_monthly_cost(instance['InstanceType'])
                spot_savings = current_cost * 0.7  # ~70% savings typical
                
                opportunity = {
                    'instance_id': instance['InstanceId'],
                    'instance_type': instance['InstanceType'],
                    'current_cost': current_cost,
                    'potential_savings': spot_savings,
                    'suitability_score': suitability['score'],
                    'recommended_strategy': suitability['strategy'],
                    'risk_level': suitability['risk']
                }
                
                opportunities[suitability['category']].append(opportunity)
        
        return opportunities
    
    def _get_running_instances(self) -> List[Dict]:
        """Get all running EC2 instances"""
        try:
            response = self.ec2_client.describe_instances(
                Filters=[{'Name': 'instance-state-name', 'Values': ['running']}]
            )
            
            instances = []
            for reservation in response['Reservations']:
                instances.extend(reservation['Instances'])
            
            return instances
        except Exception as e:
            logger.error(f"Error getting running instances: {e}")
            return []
    
    def _assess_spot_suitability(self, instance: Dict) -> Dict[str, Any]:
        """Assess if instance is suitable for spot"""
        instance_id = instance['InstanceId']
        tags = {tag['Key']: tag['Value'] for tag in instance.get('Tags', [])}
        
        # Analyze tags and patterns
        environment = tags.get('Environment', '').lower()
        workload_type = tags.get('WorkloadType', '').lower()
        
        suitability = {
            'suitable': False,
            'score': 0,
            'category': 'stateless_applications',
            'strategy': 'spot_fleet',
            'risk': 'medium'
        }
        
        # Scoring based on characteristics
        if environment in ['dev', 'test', 'staging']:
            suitability['score'] += 30
            suitability['category'] = 'dev_test_environments'
            suitability['risk'] = 'low'
        
        if 'batch' in workload_type:
            suitability['score'] += 40
            suitability['category'] = 'batch_processing'
            suitability['risk'] = 'low'
        
        if 'web' in workload_type or 'api' in workload_type:
            suitability['score'] += 20
            suitability['strategy'] = 'mixed_instances'
            suitability['risk'] = 'medium'
        
        # Instance type considerations
        if instance['InstanceType'].startswith('t3'):
            suitability['score'] += 15  # Burstable instances good for spot
        
        suitability['suitable'] = suitability['score'] >= 50
        
        return suitability

def generate_cost_optimization_report(analyzer: CloudCostAnalyzer, 
                                    rightsizer: ResourceRightsizer,
                                    spot_optimizer: SpotInstanceOptimizer) -> str:
    """Generate comprehensive cost optimization report"""
    
    # Perform analysis
    cost_analysis = analyzer.analyze_comprehensive_costs()
    rightsizing_ops = rightsizer.analyze_rightsizing_opportunities()
    spot_ops = spot_optimizer.identify_spot_opportunities()
    
    # Calculate total potential savings
    total_savings = 0
    
    # Rightsizing savings
    for category, recommendations in rightsizing_ops.items():
        total_savings += sum(rec.monthly_savings for rec in recommendations if rec.monthly_savings > 0)
    
    # Spot savings
    for category, opportunities in spot_ops.items():
        total_savings += sum(opp['potential_savings'] for opp in opportunities)
    
    # Waste elimination savings
    if 'waste_analysis' in cost_analysis:
        total_savings += cost_analysis['waste_analysis'].get('total_monthly_waste', 0)
    
    # Generate report
    report = f"""
# Cloud Cost Optimization Report
Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Executive Summary
- **Current Monthly Spend**: ${cost_analysis['total_cost']['projected_monthly']:,.2f}
- **Potential Monthly Savings**: ${total_savings:,.2f}
- **Optimization Percentage**: {(total_savings/cost_analysis['total_cost']['projected_monthly']*100):,.1f}%

## Top Cost Drivers
"""
    
    # Add service breakdown
    if 'cost_by_service' in cost_analysis:
        top_services = sorted(cost_analysis['cost_by_service'].items(), 
                            key=lambda x: x[1]['total'], reverse=True)[:5]
        
        for service, data in top_services:
            report += f"- **{service}**: ${data['total']:,.2f} (Trend: {data['trend']:+.1f}%)\n"
    
    report += "\n## Priority Recommendations\n\n"
    
    # Add rightsizing recommendations
    all_recommendations = []
    for category, recs in rightsizing_ops.items():
        all_recommendations.extend(recs)
    
    # Sort by savings potential
    all_recommendations.sort(key=lambda x: x.monthly_savings, reverse=True)
    
    for i, rec in enumerate(all_recommendations[:10], 1):
        if rec.monthly_savings > 0:
            report += f"### {i}. {rec.action}\n"
            report += f"- **Resource**: {rec.resource_id}\n"
            report += f"- **Monthly Savings**: ${rec.monthly_savings:,.2f}\n"
            report += f"- **Effort**: {rec.effort} | **Risk**: {rec.risk}\n"
            report += f"- **Reason**: {rec.reason}\n\n"
    
    # Add spot opportunities
    report += "## Spot Instance Opportunities\n\n"
    total_spot_savings = 0
    
    for category, opportunities in spot_ops.items():
        if opportunities:
            report += f"### {category.replace('_', ' ').title()}\n"
            category_savings = sum(opp['potential_savings'] for opp in opportunities)
            total_spot_savings += category_savings
            report += f"- **Instances**: {len(opportunities)}\n"
            report += f"- **Potential Savings**: ${category_savings:,.2f}/month\n\n"
    
    # Implementation timeline
    report += """
## Implementation Roadmap

### Phase 1 (Week 1-2): Quick Wins
- Terminate unused resources
- Delete unattached volumes
- Stop idle instances during off-hours

### Phase 2 (Week 3-4): Rightsizing
- Implement rightsizing for low-risk instances
- Optimize storage configurations
- Review and optimize data transfer

### Phase 3 (Month 2): Advanced Optimizations
- Implement spot instances for suitable workloads
- Purchase reserved instances for stable workloads
- Implement automated cost controls

### Phase 4 (Month 3+): Continuous Optimization
- Set up cost monitoring and alerting
- Implement cost allocation and chargeback
- Regular optimization reviews
"""
    
    return report

def main():
    """Main execution function"""
    print("🚀 Starting Cloud Cost Optimization Analysis...")
    
    try:
        # Initialize optimizers
        analyzer = CloudCostAnalyzer('aws')
        rightsizer = ResourceRightsizer()
        spot_optimizer = SpotInstanceOptimizer()
        
        # Generate comprehensive report
        report = generate_cost_optimization_report(analyzer, rightsizer, spot_optimizer)
        
        # Save report
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        report_filename = f"cost_optimization_report_{timestamp}.md"
        
        with open(report_filename, 'w') as f:
            f.write(report)
        
        print(f"✅ Cost optimization report generated: {report_filename}")
        
        # Print summary
        print("\n📊 Analysis Complete!")
        print("="*50)
        
        return report_filename
        
    except Exception as e:
        logger.error(f"Error in main execution: {e}")
        print(f"❌ Error: {e}")
        return None

if __name__ == "__main__":
    main()