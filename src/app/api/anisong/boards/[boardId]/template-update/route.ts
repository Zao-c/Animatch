import { Prisma } from "@prisma/client";
import { requireCurrentUser } from "@/lib/auth-session";
import { prisma } from "@/lib/db";
import { ok, fromError } from "@/lib/api-response";
import { AppError } from "@/lib/app-error";
import { boardView, ownedSongBoard } from "@/lib/anisong/service";
import { applySongTemplateVersion, compareSongTemplateVersions } from "@/lib/anisong/template-version";
import { MAX_TRACKS, type SongDocument } from "@/lib/anisong/types";
import { objectInput, revisionInput } from "@/lib/anisong/validation";
import { songJson } from "@/lib/anisong/audio-storage";

export const dynamic = "force-dynamic";
type Context = {params:{boardId:string}};
async function load(userId:string,boardId:string) {
  const board=await ownedSongBoard(userId,boardId);
  if(!board.templateId) throw new AppError("只有参与公共曲单的记录才能升级版本",403);
  const template=await prisma.songTemplate.findFirst({
    where:{id:board.templateId,active:true},
    select:{revision:true,title:true,document:true}
  });
  return {board,template};
}

/** The preview contains only names and IDs, never private audio source data. */
export async function GET(_request:Request,{params}:Context) {
  try {
    const user=await requireCurrentUser();
    const {board,template}=await load(user.id,params.boardId);
    if(!template) return ok({unavailable:true,outdated:false,currentRevision:board.templateRevision??0});
    const diff=compareSongTemplateVersions(board.document as unknown as SongDocument,template.document as unknown as SongDocument);
    return ok({unavailable:false,outdated:template.revision>(board.templateRevision??0),currentRevision:board.templateRevision??0,
      latestRevision:template.revision,latestTitle:template.title,diff});
  } catch(e){return fromError(e);}
}

/** Apply only after the participant explicitly clicks confirmation. Never erase votes. */
export async function POST(request:Request,{params}:Context) {
  try {
    const user=await requireCurrentUser();
    const input=objectInput(await songJson(request));
    const revision=revisionInput(input.revision);
    const target=revisionInput(input.targetRevision);
    if(typeof input.includeNew!=="boolean") throw new AppError("请选择是否加入新增歌曲",400);
    const {board,template}=await load(user.id,params.boardId);
    if(!template) throw new AppError("公共曲单已下架，保留现有个人版本即可继续对决",409);
    if(board.revision!==revision) throw new AppError("个人曲单在另一个页面已更新，请重新载入",409);
    if(template.revision!==target) throw new AppError("公共曲单刚刚更新，请重新查看变化后再确认",409);
    try {
      // Publisher updates and participant updates must have a consistent order.
      // A double-check outside a transaction is not sufficient.
      const result=await prisma.$transaction(async tx=>{
        const latest=await tx.songTemplate.findFirst({
          where:{id:board.templateId!,active:true},
          select:{revision:true,document:true}
        });
        if(!latest||latest.revision!==target)
          throw new AppError("公开曲单已再次更新，请重新查看变化后确认",409);
        let next:SongDocument;
        try{
          next=applySongTemplateVersion(board.document as unknown as SongDocument,
            latest.document as unknown as SongDocument,input.includeNew as boolean);
        }catch(cause){
          throw new AppError(cause instanceof Error?cause.message:"无法安全升级曲单",409);
        }
        if(next.tracks.length>MAX_TRACKS)
          throw new AppError("更新后超过每份曲单的歌曲数量上限，请先缩小参赛范围",400);
        const changed=await tx.songBoard.updateMany({
          where:{id:board.id,ownerId:user.id,revision},
          data:{document:next as unknown as Prisma.InputJsonValue,
            templateRevision:latest.revision,revision:{increment:1}}
        });
        if(changed.count!==1) throw new AppError("个人曲单已更新，请重新载入再操作",409);
        return boardView({...board,document:next as unknown as Prisma.JsonValue,
          templateRevision:latest.revision,revision:revision+1,updatedAt:new Date()});
      },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
      return ok(result);
    }catch(cause){
      if(cause instanceof Prisma.PrismaClientKnownRequestError && cause.code==="P2034")
        throw new AppError("同步时检测到并发更新，请重新查看最新公开曲单再试",409);
      throw cause;
    }
  } catch(e){return fromError(e);}
}
