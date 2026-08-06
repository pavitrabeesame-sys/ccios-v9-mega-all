import { NextResponse } from "next/server";
import { prisma } from "../../../src/lib/prisma";

// =========================
// GET ALL BRANDS
// =========================
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") || "";
    const fetchAll = searchParams.get("all") === "true";
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 10;

    const where = {
      OR: [
        {
          name: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          code: {
            contains: search,
            mode: "insensitive",
          },
        },
      ],
    };

    if (fetchAll) {
      let brands = await prisma.brand.findMany({
        where,
        include: {
          company: true,
          products: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Filter out internal store IDs and marketplace names from the dropdown list
      brands = brands.filter((b) => {
        const name = (b.name || "").trim();
        if (name.startsWith("Store_")) return false;
        if (name.toLowerCase() === "shopee") return false;
        return true;
      });

      return NextResponse.json({
        success: true,
        data: brands,
        brands: brands,
      });
    }

    const total = await prisma.brand.count({
      where,
    });

    let brands = await prisma.brand.findMany({
      where,
      include: {
        company: true,
        products: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    brands = brands.filter((b) => {
      const name = (b.name || "").trim();
      if (name.startsWith("Store_")) return false;
      if (name.toLowerCase() === "shopee") return false;
      return true;
    });

    return NextResponse.json({
      success: true,
      data: brands,
      brands: brands,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load brands.",
      },
      {
        status: 500,
      }
    );
  }
}

// =========================
// CREATE BRAND
// =========================
export async function POST(request) {
  try {
    const body = await request.json();

    if (!body.name || !body.code || !body.companyId) {
      return NextResponse.json(
        {
          success: false,
          message: "Please fill all required fields.",
        },
        {
          status: 400,
        }
      );
    }

    const exists = await prisma.brand.findFirst({
      where: {
        OR: [
          {
            name: body.name,
          },
          {
            code: body.code,
          },
        ],
      },
    });

    if (exists) {
      return NextResponse.json(
        {
          success: false,
          message: "Brand already exists.",
        },
        {
          status: 400,
        }
      );
    }

    const brand = await prisma.brand.create({
      data: {
        name: body.name,
        code: body.code,
        description: body.description || "",
        companyId: body.companyId,
      },
    });

    return NextResponse.json({
      success: true,
      data: brand,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create brand.",
      },
      {
        status: 500,
      }
    );
  }
}