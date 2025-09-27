#!/usr/bin/env python3
"""
Cloud Cost Optimization Framework
Comprehensive cost analysis and optimization for AWS, Azure, and GCP
"""

import boto3
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import json
import logging
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from dataclasses import dataclass

@dataclass
class CostOptimizationResult:
    """Results of cost optimization analysis"""
    resource_id: str
    resource_type: str
    current_cost: float
    optimized_cost: float
    savings: float
    recommendation: str
    confidence: str
    risk_level: str

class CloudCostAnalyzer:
    """Main cost analysis engine"""
    
    def __init__(self, cloud_provider: str = 'aws', region: str = 'us-east-1'):
        self.provider = cloud_provider
        self.region = region
        self.client = self._initialize_client()
        self.cost_data = None
        self.logger = self._setup_logging()
        
    def _initialize_client(self):
        """Initialize cloud provider client"""
        if self.provider == 'aws':
            return {
                'ce': boto3.client('ce', region_name=self.region),
                'ec2': boto3.client('ec2', region_name=self.region),
                'cloudwatch': boto3.client('cloudwatch', region_name=self.region),
                's3': boto3.client('s3'),
                'rds': boto3.client('rds', region_name=self.region),
                'lambda': boto3.client('lambda', region_name=self.region)
            }
        else:
            raise NotImplementedError(f"Provider {self.provider} not implemented")
    
    def _setup_logging(self):
        """Setup logging configuration"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        return logging.getLogger(__name__)
    
    def analyze_costs(self, time_period: int = 30) -> Dict[str, Any]:
        """Comprehensive cost analysis"""
        self.logger.info(f"Starting cost analysis for {time_period} days")
        
        analysis = {
            'total_cost': self._get_total_cost(time_period),
            'cost_by_service': self._analyze_by_service(time_period),
            'cost_by_resource': self._analyze_by_resource(time_period),
            'cost_trends': self._analyze_trends(time_period),
            'anomalies': self._detect_anomalies(time_period),
            'waste_analysis': self._identify_waste(),
            'optimization_opportunities': self._find_opportunities(),
            'forecast': self._forecast_costs()
        }
        
        return self._generate_report(analysis)
    
    def _get_total_cost(self, days: int) -> Dict[str, float]:
        """Get total cost for time period"""
        if self.provider == 'aws':
            ce = self.client['ce']
            
            response = ce.get_cost_and_usage(
                TimePeriod={
                    'Start': (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d'),
                    'End': datetime.now().strftime('%Y-%m-%d')
                },
                Granularity='MONTHLY',
                Metrics=['UnblendedCost'],
            )
            
            total = 0
            for result in response['ResultsByTime']:
                if result['Total']:
                    total += float(result['Total']['UnblendedCost']['Amount'])
            
            return {
                'total': total,
                'daily_average': total / days,
                'monthly_projection': total * (30 / days)
            }
    
    def _analyze_by_service(self, days: int) -> Dict[str, Dict]:
        """Analyze costs by service"""
        if self.provider == 'aws':
            ce = self.client['ce']
            
            response = ce.get_cost_and_usage(
                TimePeriod={
                    'Start': (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d'),
                    'End': datetime.now().strftime('%Y-%m-%d')
                },
                Granularity='DAILY',
                Metrics=['UnblendedCost'],
                GroupBy=[
                    {'Type': 'DIMENSION', 'Key': 'SERVICE'}
                ]
            )
            
            service_costs = {}
            for result in response['ResultsByTime']:
                for group in result['Groups']:
                    service = group['Keys'][0]
                    cost = float(group['Metrics']['UnblendedCost']['Amount'])
                    
                    if service not in service_costs:
                        service_costs[service] = []
                    service_costs[service].append(cost)
            
            analysis = {}
            total_cost = sum(sum(costs) for costs in service_costs.values())
            
            for service, costs in service_costs.items():
                service_total = sum(costs)
                analysis[service] = {
                    'total': service_total,
                    'average_daily': service_total / len(costs),
                    'trend': self._calculate_trend(costs),
                    'percentage': (service_total / total_cost) * 100 if total_cost > 0 else 0,
                    'volatility': np.std(costs) if len(costs) > 1 else 0
                }
            
            return analysis
    
    def _identify_waste(self) -> Dict[str, Any]:
        """Identify wasted resources and potential savings"""
        self.logger.info("Identifying waste and optimization opportunities")
        
        waste_analysis = {
            'unused_resources': self._find_unused_resources(),
            'oversized_resources': self._find_oversized_resources(),
            'unattached_storage': self._find_unattached_storage(),
            'idle_load_balancers': self._find_idle_load_balancers(),
            'old_snapshots': self._find_old_snapshots(),
            'untagged_resources': self._find_untagged_resources()
        }
        
        total_waste = sum(
            item.get('estimated_savings', 0) 
            for category in waste_analysis.values() 
            for item in (category if isinstance(category, list) else [])
        )
        
        waste_analysis['total_potential_savings'] = total_waste
        waste_analysis['summary'] = self._generate_waste_summary(waste_analysis)
        
        return waste_analysis
    
    def _find_unused_resources(self) -> List[Dict]:
        """Find resources with minimal or no usage"""
        unused = []
        
        if self.provider == 'aws':
            # Check EC2 instances
            ec2 = self.client['ec2']
            cloudwatch = self.client['cloudwatch']
            
            try:
                instances = ec2.describe_instances(
                    Filters=[{'Name': 'instance-state-name', 'Values': ['running']}]
                )
                
                for reservation in instances['Reservations']:
                    for instance in reservation['Instances']:
                        instance_id = instance['InstanceId']
                        
                        # Check CPU utilization over last 7 days
                        try:
                            metrics = cloudwatch.get_metric_statistics(
                                Namespace='AWS/EC2',
                                MetricName='CPUUtilization',
                                Dimensions=[
                                    {'Name': 'InstanceId', 'Value': instance_id}
                                ],
                                StartTime=datetime.now() - timedelta(days=7),
                                EndTime=datetime.now(),
                                Period=3600,
                                Statistics=['Average']
                            )
                            
                            if metrics['Datapoints']:
                                avg_cpu = sum(d['Average'] for d in metrics['Datapoints']) / len(metrics['Datapoints'])
                                
                                if avg_cpu < 5:  # Less than 5% CPU usage
                                    unused.append({
                                        'resource_type': 'EC2 Instance',
                                        'resource_id': instance_id,
                                        'reason': f'Average CPU: {avg_cpu:.2f}%',
                                        'estimated_savings': self._calculate_instance_cost(instance)
                                    })
                        except Exception as e:
                            self.logger.warning(f"Could not analyze instance {instance_id}: {e}")
                            
            except Exception as e:
                self.logger.error(f"Error finding unused EC2 instances: {e}")
        
        return unused
    
    def _find_oversized_resources(self) -> List[Dict]:
        """Find resources that are oversized for their usage"""
        oversized = []
        
        # This would analyze CPU, memory, and other metrics to identify oversized instances
        # Implementation would be similar to unused resources but with different thresholds
        
        return oversized
    
    def _find_unattached_storage(self) -> List[Dict]:
        """Find unattached EBS volumes"""
        unattached = []
        
        if self.provider == 'aws':
            ec2 = self.client['ec2']
            
            try:
                volumes = ec2.describe_volumes(
                    Filters=[{'Name': 'status', 'Values': ['available']}]
                )
                
                for volume in volumes['Volumes']:
                    monthly_cost = self._calculate_ebs_cost(volume)
                    unattached.append({
                        'resource_type': 'EBS Volume',
                        'resource_id': volume['VolumeId'],
                        'size_gb': volume['Size'],
                        'volume_type': volume['VolumeType'],
                        'estimated_savings': monthly_cost
                    })
                    
            except Exception as e:
                self.logger.error(f"Error finding unattached volumes: {e}")
        
        return unattached
    
    def _find_idle_load_balancers(self) -> List[Dict]:
        """Find load balancers with no traffic"""
        # Implementation for finding idle load balancers
        return []
    
    def _find_old_snapshots(self) -> List[Dict]:
        """Find old snapshots that can be deleted"""
        old_snapshots = []
        
        if self.provider == 'aws':
            ec2 = self.client['ec2']
            cutoff_date = datetime.now() - timedelta(days=30)
            
            try:
                snapshots = ec2.describe_snapshots(
                    OwnerIds=['self'],
                    Filters=[
                        {'Name': 'start-time', 'Values': [f'*{cutoff_date.strftime("%Y-%m-%d")}*']}
                    ]
                )
                
                for snapshot in snapshots['Snapshots']:
                    snapshot_date = snapshot['StartTime'].replace(tzinfo=None)
                    if snapshot_date < cutoff_date:
                        old_snapshots.append({
                            'resource_type': 'EBS Snapshot',
                            'resource_id': snapshot['SnapshotId'],
                            'age_days': (datetime.now() - snapshot_date).days,
                            'size_gb': snapshot.get('VolumeSize', 0),
                            'estimated_savings': snapshot.get('VolumeSize', 0) * 0.05  # $0.05 per GB-month
                        })
                        
            except Exception as e:
                self.logger.error(f"Error finding old snapshots: {e}")
        
        return old_snapshots
    
    def _find_untagged_resources(self) -> List[Dict]:
        """Find resources without proper tags"""
        # Implementation for finding untagged resources
        return []
    
    def _calculate_instance_cost(self, instance: Dict) -> float:
        """Calculate monthly cost for an EC2 instance"""
        # Simplified cost calculation - in reality, you'd use AWS pricing API
        instance_type = instance['InstanceType']
        
        # Basic cost estimates (simplified)
        cost_map = {
            't2.micro': 8.5,
            't2.small': 17.0,
            't2.medium': 34.0,
            't3.micro': 7.5,
            't3.small': 15.0,
            't3.medium': 30.0,
            'm5.large': 70.0,
            'm5.xlarge': 140.0,
            'c5.large': 62.0,
            'r5.large': 90.0
        }
        
        return cost_map.get(instance_type, 50.0)  # Default estimate
    
    def _calculate_ebs_cost(self, volume: Dict) -> float:
        """Calculate monthly cost for an EBS volume"""
        volume_type = volume['VolumeType']
        size_gb = volume['Size']
        
        # AWS EBS pricing (simplified)
        pricing = {
            'gp2': 0.10,  # per GB-month
            'gp3': 0.08,
            'io1': 0.125,
            'io2': 0.125,
            'st1': 0.045,
            'sc1': 0.025
        }
        
        return size_gb * pricing.get(volume_type, 0.10)
    
    def _calculate_trend(self, values: List[float]) -> str:
        """Calculate trend direction"""
        if len(values) < 2:
            return 'stable'
        
        first_half = sum(values[:len(values)//2]) / (len(values)//2)
        second_half = sum(values[len(values)//2:]) / (len(values) - len(values)//2)
        
        change = ((second_half - first_half) / first_half) * 100
        
        if change > 10:
            return 'increasing'
        elif change < -10:
            return 'decreasing'
        else:
            return 'stable'
    
    def _detect_anomalies(self, days: int) -> List[Dict]:
        """Detect cost anomalies"""
        # Implementation for anomaly detection
        return []
    
    def _find_opportunities(self) -> List[CostOptimizationResult]:
        """Find optimization opportunities"""
        opportunities = []
        
        # EC2 rightsizing opportunities
        opportunities.extend(self._find_ec2_rightsizing())
        
        # Storage optimization
        opportunities.extend(self._find_storage_optimization())
        
        # Reserved instance opportunities
        opportunities.extend(self._find_reservation_opportunities())
        
        return sorted(opportunities, key=lambda x: x.savings, reverse=True)
    
    def _find_ec2_rightsizing(self) -> List[CostOptimizationResult]:
        """Find EC2 rightsizing opportunities"""
        opportunities = []
        
        # Implementation for EC2 rightsizing analysis
        
        return opportunities
    
    def _find_storage_optimization(self) -> List[CostOptimizationResult]:
        """Find storage optimization opportunities"""
        opportunities = []
        
        # Implementation for storage optimization
        
        return opportunities
    
    def _find_reservation_opportunities(self) -> List[CostOptimizationResult]:
        """Find reservation opportunities"""
        opportunities = []
        
        # Implementation for reservation analysis
        
        return opportunities
    
    def _forecast_costs(self) -> Dict[str, float]:
        """Forecast future costs"""
        if self.provider == 'aws':
            ce = self.client['ce']
            
            try:
                response = ce.get_cost_forecast(
                    TimePeriod={
                        'Start': datetime.now().strftime('%Y-%m-%d'),
                        'End': (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
                    },
                    Metric='UnblendedCost',
                    Granularity='MONTHLY'
                )
                
                forecast_amount = float(response['Total']['Amount'])
                
                return {
                    'next_30_days': forecast_amount,
                    'confidence_level': response.get('ForecastResultsByTime', [{}])[0].get('PredictionIntervalLowerBound', 'N/A')
                }
            except Exception as e:
                self.logger.error(f"Error forecasting costs: {e}")
                return {'next_30_days': 0, 'confidence_level': 'N/A'}
    
    def _generate_waste_summary(self, waste_analysis: Dict) -> Dict[str, Any]:
        """Generate waste summary"""
        return {
            'total_categories': len([k for k in waste_analysis.keys() if k not in ['total_potential_savings', 'summary']]),
            'highest_waste_category': max(
                (k for k in waste_analysis.keys() if k not in ['total_potential_savings', 'summary']),
                key=lambda k: sum(item.get('estimated_savings', 0) for item in waste_analysis[k]),
                default='none'
            )
        }
    
    def _generate_report(self, analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Generate comprehensive cost analysis report"""
        report = {
            'analysis_date': datetime.now().isoformat(),
            'summary': {
                'total_monthly_cost': analysis['total_cost']['total'],
                'daily_average': analysis['total_cost']['daily_average'],
                'projected_monthly': analysis['total_cost']['monthly_projection'],
                'total_waste_identified': analysis['waste_analysis']['total_potential_savings'],
                'optimization_count': len(analysis['optimization_opportunities'])
            },
            'detailed_analysis': analysis,
            'recommendations': self._generate_recommendations(analysis),
            'next_steps': self._generate_next_steps(analysis)
        }
        
        return report
    
    def _generate_recommendations(self, analysis: Dict) -> List[Dict]:
        """Generate prioritized recommendations"""
        recommendations = []
        
        # High-impact recommendations
        if analysis['waste_analysis']['total_potential_savings'] > 1000:
            recommendations.append({
                'priority': 'High',
                'category': 'Waste Elimination',
                'description': 'Remove unused resources immediately',
                'potential_savings': analysis['waste_analysis']['total_potential_savings'],
                'effort': 'Low',
                'timeline': '1-2 weeks'
            })
        
        return recommendations
    
    def _generate_next_steps(self, analysis: Dict) -> List[str]:
        """Generate actionable next steps"""
        steps = [
            "Review and validate unused resource identification",
            "Implement automated resource tagging",
            "Set up cost alerts and budgets",
            "Evaluate reserved instance opportunities",
            "Implement rightsizing recommendations"
        ]
        
        return steps

if __name__ == "__main__":
    analyzer = CloudCostAnalyzer()
    results = analyzer.analyze_costs(30)
    
    print(json.dumps(results, indent=2, default=str))