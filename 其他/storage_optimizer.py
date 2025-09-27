import boto3
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple
from dataclasses import dataclass
import statistics

@dataclass
class StorageOptimization:
    resource_id: str
    resource_type: str
    current_storage_class: str
    recommended_storage_class: str
    current_size_gb: float
    access_pattern: str
    monthly_savings: float
    implementation_effort: str
    risk_level: str

class StorageOptimizer:
    def __init__(self):
        self.s3 = boto3.client('s3')
        self.ec2 = boto3.client('ec2')
        self.cloudwatch = boto3.client('cloudwatch')
        self.ce = boto3.client('ce')  # Cost Explorer
        
        # Storage class pricing per GB per month (USD)
        self.s3_pricing = {
            'STANDARD': 0.023,
            'STANDARD_IA': 0.0125,
            'ONEZONE_IA': 0.01,
            'INTELLIGENT_TIERING': 0.023,  # Base price, auto-optimizes
            'GLACIER': 0.004,
            'GLACIER_IR': 0.0036,
            'DEEP_ARCHIVE': 0.00099
        }
        
        # EBS volume pricing per GB per month
        self.ebs_pricing = {
            'gp2': 0.10,
            'gp3': 0.08,
            'io1': 0.125,
            'io2': 0.125,
            'st1': 0.045,
            'sc1': 0.025
        }
        
        # Access pattern thresholds
        self.access_thresholds = {
            'frequent': 30,      # Accessed in last 30 days
            'infrequent': 90,    # Accessed in last 90 days
            'archive': 180,      # Not accessed in 180+ days
            'deep_archive': 365  # Not accessed in 365+ days
        }
    
    def analyze_storage_costs(self):
        """Comprehensive storage cost analysis"""
        print("Analyzing storage costs and optimization opportunities...")
        
        analysis = {
            's3_buckets': self._analyze_s3_buckets(),
            'ebs_volumes': self._analyze_ebs_volumes(),
            'snapshots': self._analyze_snapshots(),
            'lifecycle_opportunities': self._find_lifecycle_opportunities(),
            'compression_opportunities': self._find_compression_opportunities(),
            'deduplication_opportunities': self._find_deduplication_opportunities()
        }
        
        return self._summarize_storage_analysis(analysis)
    
    def _analyze_s3_buckets(self) -> List[Dict]:
        """Analyze S3 bucket costs and optimization opportunities"""
        bucket_analysis = []
        
        try:
            # Get all buckets
            buckets_response = self.s3.list_buckets()
            
            for bucket in buckets_response['Buckets']:
                bucket_name = bucket['Name']
                print(f"Analyzing S3 bucket: {bucket_name}")
                
                try:
                    # Get bucket metrics
                    metrics = self._get_s3_bucket_metrics(bucket_name)
                    
                    # Analyze storage classes
                    storage_class_distribution = self._get_storage_class_distribution(bucket_name)
                    
                    # Analyze access patterns
                    access_patterns = self._analyze_s3_access_patterns(bucket_name)
                    
                    # Calculate optimization potential
                    optimization = self._calculate_s3_optimization(
                        bucket_name, metrics, storage_class_distribution, access_patterns
                    )
                    
                    bucket_analysis.append({
                        'bucket_name': bucket_name,
                        'region': self._get_bucket_region(bucket_name),
                        'total_size_gb': metrics['size_gb'],
                        'total_objects': metrics['object_count'],
                        'current_monthly_cost': metrics['monthly_cost'],
                        'storage_classes': storage_class_distribution,
                        'access_patterns': access_patterns,
                        'optimization_recommendations': optimization['recommendations'],
                        'potential_monthly_savings': optimization['savings'],
                        'lifecycle_policy_exists': self._has_lifecycle_policy(bucket_name)
                    })
                    
                except Exception as e:
                    print(f"Error analyzing bucket {bucket_name}: {e}")
                    continue
                    
        except Exception as e:
            print(f"Error listing S3 buckets: {e}")
        
        return bucket_analysis
    
    def _get_s3_bucket_metrics(self, bucket_name: str) -> Dict:
        """Get S3 bucket size and cost metrics"""
        try:
            # Get bucket size from CloudWatch
            end_time = datetime.utcnow()
            start_time = end_time - timedelta(days=2)  # Get recent data
            
            # Bucket size in bytes
            size_response = self.cloudwatch.get_metric_statistics(
                Namespace='AWS/S3',
                MetricName='BucketSizeBytes',
                Dimensions=[
                    {'Name': 'BucketName', 'Value': bucket_name},
                    {'Name': 'StorageType', 'Value': 'StandardStorage'}
                ],
                StartTime=start_time,
                EndTime=end_time,
                Period=86400,  # Daily
                Statistics=['Average']
            )
            
            # Number of objects
            objects_response = self.cloudwatch.get_metric_statistics(
                Namespace='AWS/S3',
                MetricName='NumberOfObjects',
                Dimensions=[
                    {'Name': 'BucketName', 'Value': bucket_name},
                    {'Name': 'StorageType', 'Value': 'AllStorageTypes'}
                ],
                StartTime=start_time,
                EndTime=end_time,
                Period=86400,
                Statistics=['Average']
            )
            
            # Extract values
            size_bytes = 0
            if size_response['Datapoints']:
                size_bytes = size_response['Datapoints'][-1]['Average']
            
            object_count = 0
            if objects_response['Datapoints']:
                object_count = int(objects_response['Datapoints'][-1]['Average'])
            
            size_gb = size_bytes / (1024**3)  # Convert to GB
            monthly_cost = size_gb * self.s3_pricing['STANDARD']  # Assume standard pricing
            
            return {
                'size_gb': size_gb,
                'object_count': object_count,
                'monthly_cost': monthly_cost
            }
            
        except Exception as e:
            print(f"Error getting bucket metrics for {bucket_name}: {e}")
            return {'size_gb': 0, 'object_count': 0, 'monthly_cost': 0}
    
    def _get_storage_class_distribution(self, bucket_name: str) -> Dict:
        """Get distribution of objects across storage classes"""
        try:
            # Use S3 inventory or CloudWatch insights if available
            # For now, we'll estimate based on typical patterns
            return {
                'STANDARD': 0.7,
                'STANDARD_IA': 0.2,
                'GLACIER': 0.08,
                'DEEP_ARCHIVE': 0.02
            }
            
        except Exception as e:
            print(f"Error getting storage class distribution for {bucket_name}: {e}")
            return {'STANDARD': 1.0}
    
    def _analyze_s3_access_patterns(self, bucket_name: str) -> Dict:
        """Analyze S3 access patterns"""
        try:
            # This would typically require CloudTrail data analysis
            # For demonstration, we'll simulate access patterns
            
            # Get request metrics if available
            end_time = datetime.utcnow()
            start_time = end_time - timedelta(days=30)
            
            try:
                get_requests = self.cloudwatch.get_metric_statistics(
                    Namespace='AWS/S3',
                    MetricName='NumberOfObjects',
                    Dimensions=[
                        {'Name': 'BucketName', 'Value': bucket_name},
                        {'Name': 'FilterId', 'Value': 'EntireBucket'}
                    ],
                    StartTime=start_time,
                    EndTime=end_time,
                    Period=86400,
                    Statistics=['Sum']
                )
                
                # Calculate access frequency
                total_requests = sum(dp['Sum'] for dp in get_requests.get('Datapoints', []))
                avg_daily_requests = total_requests / 30 if total_requests > 0 else 0
                
                if avg_daily_requests > 100:
                    access_pattern = 'frequent'
                elif avg_daily_requests > 10:
                    access_pattern = 'moderate'
                elif avg_daily_requests > 1:
                    access_pattern = 'infrequent'
                else:
                    access_pattern = 'archive'
                    
            except:
                # Fallback pattern analysis
                access_pattern = 'moderate'
            
            return {
                'pattern': access_pattern,
                'avg_daily_requests': avg_daily_requests if 'avg_daily_requests' in locals() else 0,
                'last_access_analysis': 'estimated'
            }
            
        except Exception as e:
            print(f"Error analyzing access patterns for {bucket_name}: {e}")
            return {'pattern': 'unknown', 'avg_daily_requests': 0}
    
    def _calculate_s3_optimization(self, bucket_name: str, metrics: Dict, 
                                  storage_classes: Dict, access_patterns: Dict) -> Dict:
        """Calculate S3 optimization recommendations and savings"""
        recommendations = []
        total_savings = 0
        
        current_size = metrics['size_gb']
        access_pattern = access_patterns['pattern']
        
        # Recommend lifecycle policies based on access patterns
        if access_pattern in ['infrequent', 'archive'] and storage_classes.get('STANDARD', 0) > 0.5:
            # Recommend transitioning to IA or Glacier
            standard_size = current_size * storage_classes.get('STANDARD', 0)
            
            if access_pattern == 'infrequent':
                new_class = 'STANDARD_IA'
                savings = standard_size * (self.s3_pricing['STANDARD'] - self.s3_pricing['STANDARD_IA'])
            else:  # archive pattern
                new_class = 'GLACIER'
                savings = standard_size * (self.s3_pricing['STANDARD'] - self.s3_pricing['GLACIER'])
            
            recommendations.append({
                'type': 'storage_class_transition',
                'description': f'Transition {standard_size:.1f}GB from STANDARD to {new_class}',
                'monthly_savings': savings,
                'implementation': 'lifecycle_policy'
            })
            
            total_savings += savings
        
        # Recommend Intelligent Tiering for unknown patterns
        if access_pattern == 'unknown' or access_pattern == 'moderate':
            it_eligible_size = current_size * 0.8  # Assume 80% eligible
            current_cost = it_eligible_size * self.s3_pricing['STANDARD']
            it_cost = it_eligible_size * self.s3_pricing['INTELLIGENT_TIERING'] * 0.7  # Assume 30% savings
            
            if current_cost > it_cost:
                savings = current_cost - it_cost
                recommendations.append({
                    'type': 'intelligent_tiering',
                    'description': f'Enable Intelligent Tiering for {it_eligible_size:.1f}GB',
                    'monthly_savings': savings,
                    'implementation': 'bucket_policy'
                })
                total_savings += savings
        
        # Recommend compression analysis
        if current_size > 100:  # Only for buckets > 100GB
            estimated_compression_savings = current_size * 0.3 * self.s3_pricing['STANDARD']  # 30% compression
            recommendations.append({
                'type': 'compression_analysis',
                'description': 'Analyze objects for compression opportunities',
                'monthly_savings': estimated_compression_savings,
                'implementation': 'content_analysis'
            })
            total_savings += estimated_compression_savings
        
        return {
            'recommendations': recommendations,
            'savings': total_savings
        }
    
    def _analyze_ebs_volumes(self) -> List[Dict]:
        """Analyze EBS volumes for optimization"""
        volume_analysis = []
        
        try:
            volumes_response = self.ec2.describe_volumes()
            
            for volume in volumes_response['Volumes']:
                volume_id = volume['VolumeId']
                volume_type = volume['VolumeType']
                size_gb = volume['Size']
                state = volume['State']
                
                # Analyze volume utilization
                utilization = self._analyze_ebs_utilization(volume_id)
                
                # Calculate optimization opportunities
                optimization = self._calculate_ebs_optimization(volume, utilization)
                
                volume_analysis.append({
                    'volume_id': volume_id,
                    'volume_type': volume_type,
                    'size_gb': size_gb,
                    'state': state,
                    'attached_instance': volume.get('Attachments', [{}])[0].get('InstanceId', 'unattached'),
                    'utilization': utilization,
                    'current_monthly_cost': size_gb * self.ebs_pricing.get(volume_type, 0.10),
                    'optimization_recommendations': optimization['recommendations'],
                    'potential_monthly_savings': optimization['savings']
                })
                
        except Exception as e:
            print(f"Error analyzing EBS volumes: {e}")
        
        return volume_analysis
    
    def _analyze_ebs_utilization(self, volume_id: str) -> Dict:
        """Analyze EBS volume utilization"""
        try:
            end_time = datetime.utcnow()
            start_time = end_time - timedelta(days=14)  # 2 weeks of data
            
            # Volume Read Ops
            read_ops_response = self.cloudwatch.get_metric_statistics(
                Namespace='AWS/EBS',
                MetricName='VolumeReadOps',
                Dimensions=[{'Name': 'VolumeId', 'Value': volume_id}],
                StartTime=start_time,
                EndTime=end_time,
                Period=3600,  # Hourly
                Statistics=['Sum']
            )
            
            # Volume Write Ops
            write_ops_response = self.cloudwatch.get_metric_statistics(
                Namespace='AWS/EBS',
                MetricName='VolumeWriteOps',
                Dimensions=[{'Name': 'VolumeId', 'Value': volume_id}],
                StartTime=start_time,
                EndTime=end_time,
                Period=3600,
                Statistics=['Sum']
            )
            
            # Calculate average IOPS
            read_ops = [dp['Sum'] for dp in read_ops_response.get('Datapoints', [])]
            write_ops = [dp['Sum'] for dp in write_ops_response.get('Datapoints', [])]
            
            avg_read_iops = sum(read_ops) / len(read_ops) / 3600 if read_ops else 0
            avg_write_iops = sum(write_ops) / len(write_ops) / 3600 if write_ops else 0
            total_iops = avg_read_iops + avg_write_iops
            
            # Determine utilization level
            if total_iops > 1000:
                utilization_level = 'high'
            elif total_iops > 100:
                utilization_level = 'medium'
            elif total_iops > 10:
                utilization_level = 'low'
            else:
                utilization_level = 'very_low'
            
            return {
                'avg_read_iops': avg_read_iops,
                'avg_write_iops': avg_write_iops,
                'total_iops': total_iops,
                'utilization_level': utilization_level,
                'data_points': len(read_ops)
            }
            
        except Exception as e:
            print(f"Error analyzing EBS utilization for {volume_id}: {e}")
            return {'utilization_level': 'unknown', 'total_iops': 0}
    
    def _calculate_ebs_optimization(self, volume: Dict, utilization: Dict) -> Dict:
        """Calculate EBS volume optimization recommendations"""
        recommendations = []
        total_savings = 0
        
        volume_type = volume['VolumeType']
        size_gb = volume['Size']
        current_cost = size_gb * self.ebs_pricing.get(volume_type, 0.10)
        
        # Recommend volume type optimization
        if volume_type == 'gp2':
            # Always recommend gp3 as it's more cost-effective
            new_cost = size_gb * self.ebs_pricing['gp3']
            savings = current_cost - new_cost
            
            recommendations.append({
                'type': 'volume_type_change',
                'description': f'Change from gp2 to gp3',
                'current_type': volume_type,
                'recommended_type': 'gp3',
                'monthly_savings': savings,
                'risk': 'low'
            })
            total_savings += savings
            
        elif volume_type in ['io1', 'io2'] and utilization['utilization_level'] in ['low', 'very_low']:
            # Recommend downgrading from provisioned IOPS to gp3
            new_cost = size_gb * self.ebs_pricing['gp3']
            savings = current_cost - new_cost
            
            recommendations.append({
                'type': 'volume_type_change',
                'description': f'Downgrade from {volume_type} to gp3 (low IOPS usage)',
                'current_type': volume_type,
                'recommended_type': 'gp3',
                'monthly_savings': savings,
                'risk': 'medium'
            })
            total_savings += savings
        
        # Check for oversized volumes (would need additional disk usage metrics)
        if utilization['utilization_level'] == 'very_low' and size_gb > 100:
            # Suggest investigating disk space utilization
            recommendations.append({
                'type': 'size_analysis',
                'description': f'Investigate disk space utilization for potential downsizing',
                'current_size': size_gb,
                'action_required': 'manual_analysis',
                'potential_savings': 'variable'
            })
        
        return {
            'recommendations': recommendations,
            'savings': total_savings
        }
    
    def _analyze_snapshots(self) -> List[Dict]:
        """Analyze EBS snapshots for cleanup opportunities"""
        snapshot_analysis = []
        
        try:
            snapshots_response = self.ec2.describe_snapshots(OwnerIds=['self'])
            
            now = datetime.now()
            
            for snapshot in snapshots_response['Snapshots']:
                snapshot_id = snapshot['SnapshotId']
                volume_id = snapshot.get('VolumeId', 'unknown')
                start_time = snapshot['StartTime'].replace(tzinfo=None)
                volume_size = snapshot['VolumeSize']
                
                age_days = (now - start_time).days
                monthly_cost = volume_size * 0.05  # $0.05 per GB-month for snapshots
                
                # Determine if snapshot is candidate for deletion
                deletion_candidate = False
                reason = ""
                
                if age_days > 365:
                    deletion_candidate = True
                    reason = f"Snapshot is {age_days} days old"
                elif age_days > 90:
                    # Check if volume still exists
                    try:
                        self.ec2.describe_volumes(VolumeIds=[volume_id])
                        volume_exists = True
                    except:
                        volume_exists = False
                        deletion_candidate = True
                        reason = "Original volume no longer exists"
                
                snapshot_analysis.append({
                    'snapshot_id': snapshot_id,
                    'volume_id': volume_id,
                    'age_days': age_days,
                    'size_gb': volume_size,
                    'monthly_cost': monthly_cost,
                    'deletion_candidate': deletion_candidate,
                    'reason': reason,
                    'monthly_savings_if_deleted': monthly_cost if deletion_candidate else 0
                })
                
        except Exception as e:
            print(f"Error analyzing snapshots: {e}")
        
        return snapshot_analysis
    
    def _find_lifecycle_opportunities(self) -> List[Dict]:
        """Find S3 buckets that would benefit from lifecycle policies"""
        opportunities = []
        
        try:
            buckets_response = self.s3.list_buckets()
            
            for bucket in buckets_response['Buckets']:
                bucket_name = bucket['Name']
                
                # Check if lifecycle policy exists
                has_lifecycle = self._has_lifecycle_policy(bucket_name)
                
                if not has_lifecycle:
                    # Estimate potential savings with lifecycle policy
                    metrics = self._get_s3_bucket_metrics(bucket_name)
                    
                    if metrics['size_gb'] > 10:  # Only for buckets > 10GB
                        # Estimate 30% of data can be moved to IA after 30 days
                        # and 20% to Glacier after 90 days
                        ia_savings = metrics['size_gb'] * 0.3 * (self.s3_pricing['STANDARD'] - self.s3_pricing['STANDARD_IA'])
                        glacier_savings = metrics['size_gb'] * 0.2 * (self.s3_pricing['STANDARD'] - self.s3_pricing['GLACIER'])
                        
                        total_savings = ia_savings + glacier_savings
                        
                        opportunities.append({
                            'bucket_name': bucket_name,
                            'current_size_gb': metrics['size_gb'],
                            'estimated_monthly_savings': total_savings,
                            'recommendation': 'Implement lifecycle policy with IA and Glacier transitions',
                            'implementation_effort': 'low'
                        })
                        
        except Exception as e:
            print(f"Error finding lifecycle opportunities: {e}")
        
        return opportunities
    
    def _find_compression_opportunities(self) -> List[Dict]:
        """Find opportunities for data compression"""
        # This would require analyzing object types and sizes
        # For demonstration, we'll provide a framework
        
        opportunities = []
        
        try:
            buckets_response = self.s3.list_buckets()
            
            for bucket in buckets_response['Buckets']:
                bucket_name = bucket['Name']
                metrics = self._get_s3_bucket_metrics(bucket_name)
                
                if metrics['size_gb'] > 50:  # Only for larger buckets
                    # Estimate compression potential based on common file types
                    estimated_compression_ratio = 0.4  # 40% size reduction
                    potential_savings = metrics['size_gb'] * estimated_compression_ratio * self.s3_pricing['STANDARD']
                    
                    opportunities.append({
                        'bucket_name': bucket_name,
                        'current_size_gb': metrics['size_gb'],
                        'estimated_compression_ratio': estimated_compression_ratio,
                        'potential_monthly_savings': potential_savings,
                        'recommendation': 'Analyze and compress large objects',
                        'implementation_effort': 'medium'
                    })
                    
        except Exception as e:
            print(f"Error finding compression opportunities: {e}")
        
        return opportunities
    
    def _find_deduplication_opportunities(self) -> List[Dict]:
        """Find opportunities for data deduplication"""
        # This would require content analysis across buckets
        # For demonstration, we'll provide a framework
        
        opportunities = []
        
        # Estimate deduplication potential for large buckets
        try:
            buckets_response = self.s3.list_buckets()
            total_storage = 0
            large_buckets = []
            
            for bucket in buckets_response['Buckets']:
                bucket_name = bucket['Name']
                metrics = self._get_s3_bucket_metrics(bucket_name)
                total_storage += metrics['size_gb']
                
                if metrics['size_gb'] > 100:
                    large_buckets.append({
                        'bucket_name': bucket_name,
                        'size_gb': metrics['size_gb']
                    })
            
            if len(large_buckets) > 1 and total_storage > 500:
                # Estimate 10-15% deduplication potential across buckets
                estimated_duplicate_ratio = 0.12
                duplicate_size = total_storage * estimated_duplicate_ratio
                potential_savings = duplicate_size * self.s3_pricing['STANDARD']
                
                opportunities.append({
                    'scope': 'cross_bucket_deduplication',
                    'total_storage_gb': total_storage,
                    'estimated_duplicate_gb': duplicate_size,
                    'potential_monthly_savings': potential_savings,
                    'recommendation': 'Implement deduplication analysis across buckets',
                    'implementation_effort': 'high'
                })
                
        except Exception as e:
            print(f"Error finding deduplication opportunities: {e}")
        
        return opportunities
    
    def create_s3_lifecycle_policies(self, bucket_name: str, access_pattern: str) -> Dict:
        """Create optimized S3 lifecycle policies"""
        
        if access_pattern == 'frequent':
            # For frequently accessed data
            rules = [{
                'ID': 'OptimizeFrequentAccess',
                'Status': 'Enabled',
                'Transitions': [
                    {
                        'Days': 90,
                        'StorageClass': 'STANDARD_IA'
                    },
                    {
                        'Days': 365,
                        'StorageClass': 'GLACIER'
                    }
                ]
            }]
        elif access_pattern == 'infrequent':
            # For infrequently accessed data
            rules = [{
                'ID': 'OptimizeInfrequentAccess',
                'Status': 'Enabled',
                'Transitions': [
                    {
                        'Days': 30,
                        'StorageClass': 'STANDARD_IA'
                    },
                    {
                        'Days': 90,
                        'StorageClass': 'GLACIER'
                    },
                    {
                        'Days': 180,
                        'StorageClass': 'DEEP_ARCHIVE'
                    }
                ]
            }]
        else:  # archive pattern
            # For archive data
            rules = [{
                'ID': 'OptimizeArchiveAccess',
                'Status': 'Enabled',
                'Transitions': [
                    {
                        'Days': 1,
                        'StorageClass': 'GLACIER_IR'
                    },
                    {
                        'Days': 90,
                        'StorageClass': 'DEEP_ARCHIVE'
                    }
                ]
            }]
        
        # Add multipart upload cleanup
        rules.append({
            'ID': 'CleanupIncompleteUploads',
            'Status': 'Enabled',
            'AbortIncompleteMultipartUpload': {
                'DaysAfterInitiation': 7
            }
        })
        
        # Add old version management
        rules.append({
            'ID': 'ManageOldVersions',
            'Status': 'Enabled',
            'NoncurrentVersionTransitions': [
                {
                    'NoncurrentDays': 30,
                    'StorageClass': 'STANDARD_IA'
                },
                {
                    'NoncurrentDays': 90,
                    'StorageClass': 'GLACIER'
                }
            ],
            'NoncurrentVersionExpiration': {
                'NoncurrentDays': 365
            }
        })
        
        return {
            'Rules': rules
        }
    
    def implement_storage_optimizations(self, optimizations: List[StorageOptimization], 
                                      dry_run: bool = True) -> List[Dict]:
        """Implement storage optimizations"""
        results = []
        
        for optimization in optimizations:
            try:
                if optimization.resource_type == 's3_bucket':
                    result = self._implement_s3_optimization(optimization, dry_run)
                elif optimization.resource_type == 'ebs_volume':
                    result = self._implement_ebs_optimization(optimization, dry_run)
                elif optimization.resource_type == 'ebs_snapshot':
                    result = self._implement_snapshot_optimization(optimization, dry_run)
                else:
                    result = {
                        'resource_id': optimization.resource_id,
                        'status': 'unsupported',
                        'message': 'Resource type not supported'
                    }
                
                results.append(result)
                
            except Exception as e:
                results.append({
                    'resource_id': optimization.resource_id,
                    'status': 'failed',
                    'error': str(e)
                })
        
        return results
    
    def _implement_s3_optimization(self, optimization: StorageOptimization, dry_run: bool) -> Dict:
        """Implement S3 optimization"""
        bucket_name = optimization.resource_id
        
        if not dry_run:
            # Create lifecycle policy
            access_pattern = optimization.access_pattern
            lifecycle_config = self.create_s3_lifecycle_policies(bucket_name, access_pattern)
            
            try:
                self.s3.put_bucket_lifecycle_configuration(
                    Bucket=bucket_name,
                    LifecycleConfiguration=lifecycle_config
                )
                
                return {
                    'resource_id': bucket_name,
                    'status': 'success',
                    'action': 'lifecycle_policy_applied',
                    'estimated_monthly_savings': optimization.monthly_savings
                }
                
            except Exception as e:
                return {
                    'resource_id': bucket_name,
                    'status': 'failed',
                    'error': str(e)
                }
        else:
            return {
                'resource_id': bucket_name,
                'status': 'dry_run_success',
                'action': 'would_apply_lifecycle_policy',
                'estimated_monthly_savings': optimization.monthly_savings
            }
    
    def _summarize_storage_analysis(self, analysis: Dict) -> Dict:
        """Summarize storage analysis results"""
        summary = {
            'total_s3_buckets': len(analysis['s3_buckets']),
            'total_ebs_volumes': len(analysis['ebs_volumes']),
            'total_snapshots': len(analysis['snapshots']),
            'total_storage_cost': 0,
            'total_potential_savings': 0,
            'top_opportunities': []
        }
        
        # Calculate totals
        for bucket in analysis['s3_buckets']:
            summary['total_storage_cost'] += bucket['current_monthly_cost']
            summary['total_potential_savings'] += bucket['potential_monthly_savings']
        
        for volume in analysis['ebs_volumes']:
            summary['total_storage_cost'] += volume['current_monthly_cost']
            summary['total_potential_savings'] += volume['potential_monthly_savings']
        
        for snapshot in analysis['snapshots']:
            summary['total_storage_cost'] += snapshot['monthly_cost']
            if snapshot['deletion_candidate']:
                summary['total_potential_savings'] += snapshot['monthly_savings_if_deleted']
        
        # Add lifecycle and compression savings
        for opp in analysis['lifecycle_opportunities']:
            summary['total_potential_savings'] += opp['estimated_monthly_savings']
        
        for opp in analysis['compression_opportunities']:
            summary['total_potential_savings'] += opp['potential_monthly_savings']
        
        # Collect top opportunities
        all_opportunities = []
        
        for bucket in analysis['s3_buckets']:
            if bucket['potential_monthly_savings'] > 0:
                all_opportunities.append({
                    'resource_id': bucket['bucket_name'],
                    'type': 's3_bucket',
                    'savings': bucket['potential_monthly_savings'],
                    'description': f"S3 bucket optimization"
                })
        
        for volume in analysis['ebs_volumes']:
            if volume['potential_monthly_savings'] > 0:
                all_opportunities.append({
                    'resource_id': volume['volume_id'],
                    'type': 'ebs_volume',
                    'savings': volume['potential_monthly_savings'],
                    'description': f"EBS volume optimization"
                })
        
        # Sort and get top 10
        summary['top_opportunities'] = sorted(all_opportunities, 
                                            key=lambda x: x['savings'], reverse=True)[:10]
        
        summary['analysis_details'] = analysis
        
        return summary
    
    # Helper methods
    def _get_bucket_region(self, bucket_name: str) -> str:
        """Get S3 bucket region"""
        try:
            response = self.s3.get_bucket_location(Bucket=bucket_name)
            return response['LocationConstraint'] or 'us-east-1'
        except:
            return 'unknown'
    
    def _has_lifecycle_policy(self, bucket_name: str) -> bool:
        """Check if bucket has lifecycle policy"""
        try:
            self.s3.get_bucket_lifecycle_configuration(Bucket=bucket_name)
            return True
        except:
            return False

def main():
    """Main function to demonstrate storage optimization"""
    optimizer = StorageOptimizer()
    
    try:
        print("Starting storage cost optimization analysis...")
        
        # Analyze storage costs
        analysis = optimizer.analyze_storage_costs()
        
        print(f"\nStorage Analysis Summary:")
        print(f"Total S3 Buckets: {analysis['total_s3_buckets']}")
        print(f"Total EBS Volumes: {analysis['total_ebs_volumes']}")
        print(f"Total Snapshots: {analysis['total_snapshots']}")
        print(f"Total Monthly Storage Cost: ${analysis['total_storage_cost']:.2f}")
        print(f"Total Potential Monthly Savings: ${analysis['total_potential_savings']:.2f}")
        
        if analysis['total_potential_savings'] > 0:
            print(f"Potential Annual Savings: ${analysis['total_potential_savings'] * 12:.2f}")
            print(f"Cost Reduction Percentage: {(analysis['total_potential_savings'] / analysis['total_storage_cost']) * 100:.1f}%")
        
        # Show top opportunities
        print(f"\nTop 10 Storage Optimization Opportunities:")
        print("-" * 60)
        for i, opp in enumerate(analysis['top_opportunities'], 1):
            print(f"{i:2d}. {opp['resource_id']:<30} ${opp['savings']:>8.2f}/month")
        
        # Save detailed analysis
        with open('storage_optimization_analysis.json', 'w') as f:
            json.dump(analysis, f, indent=2, default=str)
        
        print(f"\nDetailed analysis saved to storage_optimization_analysis.json")
        
    except Exception as e:
        print(f"Error during storage optimization analysis: {e}")
        print("Make sure you have proper AWS credentials and permissions.")

if __name__ == "__main__":
    main()