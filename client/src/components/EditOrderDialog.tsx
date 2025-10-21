import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Edit } from "lucide-react";

const editOrderSchema = z.object({
  quantity: z.string().min(1, "Quantity is required"),
  price: z.string().min(1, "Price is required"),
});

type EditOrderFormData = z.infer<typeof editOrderSchema>;

interface EditOrderDialogProps {
  orderId: string;
  currentQuantity: string;
  currentPrice: string;
  symbol: string;
  side: string;
  userId: string;
}

export default function EditOrderDialog({
  orderId,
  currentQuantity,
  currentPrice,
  symbol,
  side,
  userId,
}: EditOrderDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<EditOrderFormData>({
    resolver: zodResolver(editOrderSchema),
    defaultValues: {
      quantity: currentQuantity,
      price: currentPrice,
    },
  });

  // Reset form with latest values when dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        quantity: currentQuantity,
        price: currentPrice,
      });
    }
  }, [open, currentQuantity, currentPrice, form]);

  const editMutation = useMutation({
    mutationFn: async (data: EditOrderFormData) => {
      return await apiRequest("PATCH", `/api/paper/order/${orderId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/paper/orders", userId] });
      toast({
        title: "Order Updated",
        description: "Your order has been modified successfully.",
      });
      setOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update order",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: EditOrderFormData) => {
    const quantityNum = parseFloat(data.quantity);
    const priceNum = parseFloat(data.price);

    if (isNaN(quantityNum) || quantityNum <= 0) {
      toast({
        title: "Invalid Quantity",
        description: "Quantity must be a positive number",
        variant: "destructive",
      });
      return;
    }

    if (isNaN(priceNum) || priceNum <= 0) {
      toast({
        title: "Invalid Price",
        description: "Price must be a positive number",
        variant: "destructive",
      });
      return;
    }

    editMutation.mutate(data);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        data-testid={`button-edit-order-${orderId}`}
      >
        <Edit className="h-4 w-4 mr-1" />
        Edit
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="dialog-edit-order">
          <DialogHeader>
            <DialogTitle>Edit Order</DialogTitle>
            <DialogDescription>
              Modify the price and quantity for your {side.toUpperCase()} {symbol} order
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.00000001"
                        placeholder="0.00"
                        data-testid="input-edit-quantity"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price (USD)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        data-testid="input-edit-price"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={editMutation.isPending}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={editMutation.isPending}
                  data-testid="button-confirm-edit"
                >
                  {editMutation.isPending ? "Updating..." : "Update Order"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
