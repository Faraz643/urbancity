import { prisma } from '../db';

const billboards = [
  { id:'102', name:'Billboard #102', type:'PREMIUM', positionX:0, positionY:4, positionZ:-22, rotationY:0, width:6, height:3.5, location:'North Main Road', trafficRadius:18, trafficRating:'HIGH', visibilityRating:'EXCELLENT', minBid:5000, currentBid:5000 },
  { id:'207', name:'Billboard #207', type:'PREMIUM', positionX:0, positionY:4, positionZ:22, rotationY:Math.PI, width:6, height:3.5, location:'South Main Road', trafficRadius:18, trafficRating:'HIGH', visibilityRating:'EXCELLENT', minBid:8200, currentBid:8200 },
  { id:'311', name:'Billboard #311', type:'STREET', positionX:28, positionY:3, positionZ:-14, rotationY:0, width:3.5, height:2.5, location:'East Street', trafficRadius:14, trafficRating:'MEDIUM', visibilityRating:'GOOD', minBid:1800, currentBid:1800 },
  { id:'412', name:'Billboard #412', type:'STREET', positionX:-28, positionY:3, positionZ:4, rotationY:0, width:3.5, height:2.5, location:'West Street', trafficRadius:14, trafficRating:'MEDIUM', visibilityRating:'GOOD', minBid:2200, currentBid:2200 },
  { id:'501', name:'Corner Northwest', type:'STREET', positionX:-53, positionY:4, positionZ:-53, rotationY:Math.PI/4, width:3, height:2.2, location:'Northwest perimeter', trafficRadius:12, trafficRating:'MEDIUM', visibilityRating:'EXCELLENT', minBid:2400, currentBid:2400 },
  { id:'502', name:'Corner Northeast', type:'STREET', positionX:53, positionY:4, positionZ:-53, rotationY:-Math.PI/4, width:3, height:2.2, location:'Northeast perimeter', trafficRadius:12, trafficRating:'MEDIUM', visibilityRating:'EXCELLENT', minBid:2400, currentBid:2400 },
  { id:'503', name:'Corner Southwest', type:'STREET', positionX:-53, positionY:4, positionZ:53, rotationY:Math.PI*3/4, width:3, height:2.2, location:'Southwest perimeter', trafficRadius:12, trafficRating:'MEDIUM', visibilityRating:'EXCELLENT', minBid:2400, currentBid:2400 },
  { id:'504', name:'Corner Southeast', type:'STREET', positionX:53, positionY:4, positionZ:53, rotationY:-Math.PI*3/4, width:3, height:2.2, location:'Southeast perimeter', trafficRadius:12, trafficRating:'MEDIUM', visibilityRating:'EXCELLENT', minBid:2400, currentBid:2400 },
  { id:'W01', name:'Wall Ad W01', type:'WALL', positionX:-20, positionY:9, positionZ:-34.47, rotationY:0, width:5.8, height:3.4, location:'North building wall', trafficRadius:14, trafficRating:'HIGH', visibilityRating:'EXCELLENT', minBid:3200, currentBid:3200 },
  { id:'W02', name:'Wall Ad W02', type:'WALL', positionX:20, positionY:10, positionZ:-24.47, rotationY:0, width:7.2, height:4.2, location:'North east building wall', trafficRadius:14, trafficRating:'HIGH', visibilityRating:'EXCELLENT', minBid:4500, currentBid:4500 },
  { id:'W03', name:'Wall Ad W03', type:'WALL', positionX:-20, positionY:10, positionZ:17.04, rotationY:0, width:6.2, height:3.8, location:'South building wall', trafficRadius:14, trafficRating:'HIGH', visibilityRating:'EXCELLENT', minBid:3600, currentBid:3600 },
  { id:'W04', name:'Wall Ad W04', type:'WALL', positionX:34, positionY:12, positionZ:17.54, rotationY:0, width:7.4, height:4.2, location:'East building wall', trafficRadius:14, trafficRating:'MEDIUM', visibilityRating:'GOOD', minBid:2800, currentBid:2800 },
  { id:'W05', name:'Wall Ad W05', type:'WALL', positionX:-33, positionY:12, positionZ:16.04, rotationY:0, width:7.4, height:4.1, location:'West building wall', trafficRadius:14, trafficRating:'MEDIUM', visibilityRating:'GOOD', minBid:2600, currentBid:2600 },
];

async function seed() {
  console.log('Seeding UrbanCity database...');

  const admin = await prisma.user.upsert({
    where:{email:'admin@urbancity.local'},
    update:{role:'ADMIN',displayName:'Administrator'},
    create:{email:'admin@urbancity.local',username:'admin',passwordHash:'$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6',displayName:'Administrator',role:'ADMIN'},
  });
  await prisma.wallet.upsert({where:{userId:admin.id},update:{balance:1000000},create:{userId:admin.id,balance:1000000}});

  const demo = await prisma.user.upsert({
    where:{email:'demo@urbancity.local'},
    update:{displayName:'Demo User'},
    create:{email:'demo@urbancity.local',username:'demo',passwordHash:'$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6',displayName:'Demo User'},
  });
  await prisma.wallet.upsert({where:{userId:demo.id},update:{balance:500000},create:{userId:demo.id,balance:500000}});

  for(const billboard of billboards){
    await prisma.billboard.upsert({
      where:{id:billboard.id},
      update:billboard,
      create:billboard,
    });
  }

  console.log('Seed completed: '+billboards.length+' map advertising locations.');
}

seed().catch((error)=>{console.error(error);process.exit(1);})
.finally(async()=>{await prisma.$disconnect();});
